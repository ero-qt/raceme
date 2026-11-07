{
  lib,
  stdenv,
  stdenvNoCC,
  autoPatchelfHook,
  bun,
  makeWrapper,
  nodejs,
  basePath ? "apps/raceme",
}:
let
  releaseHeading = "## [[]([0-9.]+)[]] - .*";
  changelogLines = lib.splitString "\n" (builtins.readFile ./changelog.md);
  releaseLine = lib.findFirst (line: builtins.match releaseHeading line != null) (throw
    "changelog.md has no release section"
  ) changelogLines;
  version = builtins.head (builtins.match releaseHeading releaseLine);

  src = lib.fileset.toSource {
    root = ./.;
    fileset = lib.fileset.unions [
      ./bun.lock
      ./index.html
      ./package.json
      ./src
      ./tsconfig.json
      ./vite.config.ts
    ];
  };

  # Downloads the packages in bun.lock in a build with network access because the
  # build of the page runs without one.
  nodeModules = stdenvNoCC.mkDerivation {
    pname = "raceme-node-modules";
    inherit version;
    src = lib.fileset.toSource {
      root = ./.;
      fileset = lib.fileset.unions [
        ./bun.lock
        ./package.json
      ];
    };
    nativeBuildInputs = [ bun ];
    dontConfigure = true;
    dontFixup = true;
    buildPhase = ''
      runHook preBuild
      export HOME=$TMPDIR
      bun install --frozen-lockfile --ignore-scripts --no-progress --no-summary
      runHook postBuild
    '';
    installPhase = ''
      runHook preInstall
      cp -r node_modules $out
      runHook postInstall
    '';
    outputHashMode = "recursive";
    outputHash = "sha256-vAb2II+8xzj0P0XDhFwZvW3pC1EcfW3Lty668AFKrY8=";
  };
in
stdenv.mkDerivation {
  pname = "raceme";
  inherit version src;

  nativeBuildInputs = [
    autoPatchelfHook
    bun
    makeWrapper
    nodejs
  ];
  # Gives the prebuilt esbuild, lightningcss and rolldown binaries from npm the
  # libraries they link against because the sandbox has no system libraries.
  buildInputs = [ stdenv.cc.cc.lib ];
  autoPatchelfIgnoreMissingDeps = true;

  env.RACEME_BASE_PATH = basePath;

  configurePhase = ''
    runHook preConfigure
    export HOME=$TMPDIR
    cp -r ${nodeModules} node_modules
    chmod -R u+w node_modules
    autoPatchelf node_modules
    patchShebangs node_modules
    runHook postConfigure
  '';

  buildPhase = ''
    runHook preBuild
    bun run build
    bun build src/index.ts --target bun --outfile server.js
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    mkdir -p $out/lib/raceme
    cp -r dist/client $out/lib/raceme/client
    cp server.js $out/lib/raceme/server.js
    makeWrapper ${lib.getExe bun} $out/bin/raceme --add-flags $out/lib/raceme/server.js
    runHook postInstall
  '';

  meta = {
    description = "Speedrun race rooms that work like SpeedRunsLive did";
    homepage = "https://github.com/ero-qt/raceme";
    license = lib.licenses.bsd0;
    mainProgram = "raceme";
    platforms = [ "x86_64-linux" ];
  };
}
