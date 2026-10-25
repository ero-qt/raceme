import {
  type JSX,
  Match,
  Suspense,
  Switch,
  createSignal,
  lazy,
  onCleanup,
  useTransition,
} from "solid-js";
import { HomePage } from "./home/home-page.tsx";
import { SiteHeader } from "./layout/site-header.tsx";
import { RoomPage } from "./room/room-page.tsx";

const Catalog = lazy(() => import("./catalog/catalog.tsx").then((m) => ({ default: m.Catalog })));

const roomPath = /^\/([a-z2-7]{10})$/;

function currentPath(): string {
  return location.pathname.slice(import.meta.env.BASE_URL.length - 1);
}

/**
 * Picks the page from the path below the base path. Moving between pages stays in the page and
 * runs as a transition, so the old page stays up until the new one has loaded, without a flash.
 */
export function App(): JSX.Element {
  const [path, setPath] = createSignal(currentPath());
  const [pending, startTransition] = useTransition();

  const onPopState = () => void startTransition(() => setPath(currentPath()));
  addEventListener("popstate", onPopState);
  onCleanup(() => removeEventListener("popstate", onPopState));

  const openRoom = (slug: string) => {
    history.pushState(null, "", `${import.meta.env.BASE_URL}${slug}`);
    void startTransition(() => setPath(currentPath()));
  };
  const goHome = () => {
    history.pushState(null, "", import.meta.env.BASE_URL);
    void startTransition(() => setPath(currentPath()));
  };

  const roomSlug = () => roomPath.exec(path())?.[1];

  return (
    <>
      <SiteHeader onHome={goHome} />
      <Suspense fallback={<main aria-busy="true" />}>
        <Switch fallback={<HomePage open={openRoom} busy={pending()} />}>
          <Match when={path() === "/catalog"}>
            <Catalog />
          </Match>
          <Match when={roomSlug()} keyed>
            {(slug) => <RoomPage slug={slug} openRoom={openRoom} />}
          </Match>
        </Switch>
      </Suspense>
    </>
  );
}
