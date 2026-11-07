{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.raceme;

  # Fixes the ids so copied files keep their owner.
  uid = 991;
  gid = 977;

  domain = "ero-qt.eu";
  basePath = "apps/raceme";
  port = 8790;
  adminSocket = "/run/raceme/admin.sock";
  server = "${cfg.package}/lib/raceme/server.js";
  withAlerts = cfg.alertWebhookFile != null;

  restart = pkgs.writeShellApplication {
    name = "raceme-restart";
    runtimeInputs = [
      pkgs.coreutils
      pkgs.curl
      pkgs.jq
      pkgs.systemd
      pkgs.util-linux
    ];
    text = ''
      pid=$(systemctl show --property MainPID --value raceme.service)
      if [ "$pid" = 0 ]; then
        exit 0
      fi
      # Reads the path the process started with because the unit file already points
      # at the new package after a rebuild.
      running=$(tr '\0' '\n' <"/proc/$pid/cmdline" | grep -m1 '/server\.js$' || true)
      if [ "$running" = "${server}" ]; then
        exit 0
      fi

      status=$(curl -fsS --max-time 5 http://127.0.0.1:${toString port}/${basePath}/api/status)
      rooms=$(jq -r .rooms <<<"$status")
      restart_at=$(jq -r '.restartAt // 0' <<<"$status")
      now=$(($(date +%s) * 1000))
      if [ "$rooms" -eq 0 ] || { [ "$restart_at" -ne 0 ] && [ "$now" -ge "$restart_at" ]; }; then
        systemctl restart raceme.service
        echo "restarted raceme for ${cfg.package}"
      elif [ "$restart_at" -eq 0 ]; then
        # Queues the restart as the raceme user because only that user can open the
        # admin socket.
        setpriv --reuid raceme --regid raceme --clear-groups \
          curl -fsS --max-time 5 -X POST -o /dev/null --unix-socket ${adminSocket} http://raceme/restart
        echo "restart queued, $rooms rooms open"
      fi
    '';
  };
in
{
  options.services.raceme = {
    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.callPackage ./package.nix { };
      defaultText = lib.literalExpression "pkgs.callPackage ./package.nix { }";
      description = "The raceme build to run.";
    };
    alertWebhookFile = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = "/run/secrets/raceme-discord-webhook";
      description = ''
        File with the Discord webhook URL that gets a message when rooms or people online
        pass a level. The service starts from `secrets.target` when it's set and at boot
        when it's `null`.
      '';
    };
  };

  config = {
    users.groups.raceme.gid = gid;
    users.users.raceme = {
      isSystemUser = true;
      inherit uid;
      group = "raceme";
    };

    systemd.services.raceme = {
      description = "raceme race rooms";
      wantedBy = [ (if withAlerts then "secrets.target" else "multi-user.target") ];
      after = [ "network-online.target" ] ++ lib.optional withAlerts "secrets.target";
      wants = [ "network-online.target" ];
      # Keeps the running server through `nixos-rebuild switch` because a restart
      # closes every open room. The raceme-restart timer restarts it for a new package
      # once no rooms are open.
      restartIfChanged = false;
      stopIfChanged = false;

      environment = {
        PORT = toString port;
        RACEME_ADMIN_SOCKET = adminSocket;
        RACEME_BASE_PATH = basePath;
        RACEME_HOST = "127.0.0.1";
        RACEME_ORIGIN = "https://${domain}";
        RACEME_STATIC_DIR = "${cfg.package}/lib/raceme/client";
        RACEME_TRUST_PROXY = "1";
      }
      // lib.optionalAttrs withAlerts { RACEME_ALERT_WEBHOOK_FILE = "%d/discord-webhook"; };

      serviceConfig = {
        User = "raceme";
        Group = "raceme";
        ExecStart = lib.getExe cfg.package;
        Restart = "on-failure";
        # Hands the server a copy of the webhook file so the file itself can stay
        # root-only.
        LoadCredential = lib.optional withAlerts "discord-webhook:${cfg.alertWebhookFile}";
        # Opens the admin socket to the raceme user only because any other local account
        # could queue a restart through it.
        RuntimeDirectory = "raceme";
        UMask = "0077";

        MemoryMax = "1G";
        CPUQuota = "100%";
        TasksMax = 256;
        CapabilityBoundingSet = "";
        LockPersonality = true;
        NoNewPrivileges = true;
        PrivateDevices = true;
        PrivateTmp = true;
        ProtectClock = true;
        ProtectControlGroups = true;
        ProtectHome = true;
        ProtectHostname = true;
        ProtectKernelLogs = true;
        ProtectKernelModules = true;
        ProtectKernelTunables = true;
        ProtectSystem = "strict";
        RestrictAddressFamilies = [
          "AF_INET"
          "AF_INET6"
          "AF_UNIX"
        ];
        RestrictNamespaces = true;
        RestrictRealtime = true;
        RestrictSUIDSGID = true;
        SystemCallArchitectures = "native";
        SystemCallFilter = [ "@system-service" ];
      };
    };

    systemd.services.raceme-restart = {
      description = "Restart raceme for a new package once no rooms are open";
      after = [ "raceme.service" ];
      serviceConfig = {
        Type = "oneshot";
        ExecStart = lib.getExe restart;
      };
    };
    systemd.timers.raceme-restart = {
      wantedBy = [ "timers.target" ];
      timerConfig = {
        OnBootSec = "2min";
        OnUnitActiveSec = "10min";
      };
    };

    services.caddy = {
      enable = true;
      virtualHosts.${domain}.extraConfig = ''
        redir / /${basePath}
        encode zstd gzip
        @raceme path /${basePath} /${basePath}/*
        reverse_proxy @raceme 127.0.0.1:${toString port}
      '';
    };
  };
}
