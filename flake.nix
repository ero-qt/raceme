{
  description = "raceme race rooms at ero-qt.eu as a NixOS module";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
    in
    {
      nixosModules.default = ./module.nix;

      packages.${system}.default = pkgs.callPackage ./package.nix { };

      checks.${system}.nixos = import ./tests/nixos.nix {
        inherit pkgs;
        module = self.nixosModules.default;
      };

      formatter.${system} = pkgs.nixfmt-tree;
    };
}
