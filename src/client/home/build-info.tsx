import { type JSX, Show, createResource } from "solid-js";
import * as styles from "../layout/site-footer.css.ts";

interface Release {
  release: string;
  repository: string;
  commit: string;
  digest: string;
}

/** Asks the server which release it runs, `null` for a build that didn't come from a release. */
async function loadRelease(): Promise<Release | null> {
  const response = await fetch(`${import.meta.env.BASE_URL}api/build`).catch(() => null);
  const body = response?.ok ? ((await response.json().catch(() => ({}))) as Partial<Release>) : {};
  return body.release && body.repository && body.commit && body.digest ? (body as Release) : null;
}

/** Shows which release and commit this server runs and how to check it against the source. */
export function BuildInfoText(): JSX.Element {
  const [release] = createResource(loadRelease);

  return (
    <Show when={!release.loading} fallback={<p aria-busy="true">Loading…</p>}>
      <Show
        when={release()}
        fallback={<p>This server runs an unverified build that didn't come from a release.</p>}
      >
        {(release) => {
          const repo = () => new URL(release().repository).pathname.slice(1);
          return (
            <>
              <p>
                Source: <a href={release().repository}>{repo()}</a>
              </p>
              <p>
                This server runs{" "}
                <a href={`${release().repository}/releases/tag/${release().release}`}>
                  release {release().release}
                </a>{" "}
                from commit{" "}
                <a href={`${release().repository}/commit/${release().commit}`}>
                  {release().commit.slice(0, 7)}
                </a>
                , built and attested by GitHub Actions. The release tarball's digest is:
              </p>
              <p>
                <code class={styles.digest}>{release().digest}</code>
              </p>
              <p>
                To check it, download <code>raceme.tar.gz</code> from that release, compare the
                output of <code>sha256sum raceme.tar.gz</code> with the digest and run{" "}
                <code class={styles.digest}>
                  gh attestation verify raceme.tar.gz --repo {repo()} --signer-workflow {repo()}
                  /.github/workflows/release.yml
                </code>
                .
              </p>
            </>
          );
        }}
      </Show>
    </Show>
  );
}
