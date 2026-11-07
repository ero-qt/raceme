{ pkgs, module }:
pkgs.testers.runNixOSTest {
  name = "raceme";

  nodes.machine = {
    imports = [ module ];

    # Adds the target that a host starts once its secrets are in place, because the
    # module only starts from that target.
    systemd.targets.secrets.description = "Secrets in /run/secrets";

    # Replaces Let's Encrypt with a local certificate authority because the VM can't
    # reach it.
    services.caddy.globalConfig = "local_certs";
    networking.hosts."127.0.0.1" = [ "ero-qt.eu" ];

    users.users.other.isNormalUser = true;
  };

  testScript = ''
    status_url = "http://127.0.0.1:8790/apps/raceme/api/status"
    admin = "curl -fsS --max-time 5 --unix-socket /run/raceme/admin.sock http://raceme/restart"

    def main_pid():
        return machine.succeed("systemctl show --property MainPID --value raceme.service").strip()

    machine.wait_for_unit("multi-user.target")

    with subtest("raceme waits for secrets.target"):
        machine.fail("systemctl is-active raceme.service")
        machine.succeed("install -D -m 0400 /dev/null /run/secrets/raceme-discord-webhook")
        machine.systemctl("start secrets.target")
        machine.wait_for_unit("raceme.service")
        machine.wait_until_succeeds(f"curl -fsS {status_url}")

    with subtest("raceme runs as its own user with the live ids"):
        assert machine.succeed("id -u raceme").strip() == "991"
        assert machine.succeed("id -g raceme").strip() == "977"
        assert machine.succeed(f"stat -c %U /proc/{main_pid()}").strip() == "raceme"

    with subtest("Caddy serves the site under /apps/raceme"):
        machine.wait_until_succeeds("curl -fsk https://ero-qt.eu/apps/raceme/api/status")
        redirect = machine.succeed("curl -sk -o /dev/null -w '%{http_code} %{redirect_url}' https://ero-qt.eu/")
        assert redirect == "302 https://ero-qt.eu/apps/raceme", redirect
        page = machine.succeed("curl -fsk https://ero-qt.eu/apps/raceme/")
        assert "<script" in page, page
        headers = machine.succeed("curl -fsk -D - -o /dev/null https://ero-qt.eu/apps/raceme/api/status")
        assert "x-robots-tag: noindex" in headers.lower(), headers

    with subtest("Only the raceme user can queue a restart"):
        machine.fail(f"runuser -u other -- {admin}")
        as_raceme = "setpriv --reuid raceme --regid raceme --clear-groups"
        machine.succeed(f"{as_raceme} {admin} -X POST | grep -v '\"restartAt\":null'")
        machine.succeed(f"curl -fsS {status_url} | grep -v '\"restartAt\":null'")

    with subtest("raceme-restart leaves the current package running"):
        pid = main_pid()
        machine.systemctl("start raceme-restart.service")
        assert main_pid() == pid

    with subtest("raceme comes back after a restart"):
        machine.systemctl("restart raceme.service")
        machine.wait_for_unit("raceme.service")
        machine.wait_until_succeeds(f"curl -fsS {status_url} | grep '\"rooms\":0'")
        assert main_pid() != pid
  '';
}
