import { Check, Copy, Download, X } from "lucide-solid";
import { type JSX, Show, createResource, createSignal, onCleanup } from "solid-js";
import type { RaceState } from "../../shared/race/race.ts";
import {
  exportFileName,
  resultsCsv,
  resultsImageRows,
  resultsJson,
  resultsText,
} from "../../shared/results.ts";
import { Button } from "../primitives/button.tsx";
import { numberField } from "../styles/controls.css.ts";
import { resultsImage } from "./results-image.ts";
import * as styles from "./room.css.ts";

const copiedForMs = 2_000;
// Highlights up to this many places in the image unless the viewer picks another number.
const defaultTop = 10;

/**
 * Gives the small first line of the chat text, a link to raceme and the race's date and time in
 * the viewer's time zone. `-#` makes it small print in Discord.
 */
function chatHeading(race: RaceState): string {
  const site = new URL(import.meta.env.BASE_URL, location.origin).href;
  const started = new Date(race.startsAt ?? race.endedAt ?? Date.now());
  const time = started.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `-# [raceme](${site}) · ${started.toLocaleDateString()} ${time}`;
}

function save(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Offers the finished race's results as chat text, CSV, JSON and an image, one row each:
 * a name that opens a preview, room for a setting, then copy and download.
 */
export function ResultsExport(props: { race: RaceState }): JSX.Element {
  const placed = () => resultsImageRows(props.race).filter((row) => row.place !== "").length;
  const [top, setTop] = createSignal(Math.min(defaultTop, placed()));
  const saveText = (make: (race: RaceState) => string, type: string, extension: "csv" | "json") =>
    save(new Blob([make(props.race)], { type }), exportFileName(props.race, extension));
  const image = () => resultsImage(props.race, top());

  return (
    <section class={styles.exportSection} aria-label="Results">
      <ExportRow name="text">
        <TextPreview name="text" text={resultsText(props.race, chatHeading(props.race))} />
      </ExportRow>
      <ExportRow name="csv" download={async () => saveText(resultsCsv, "text/csv", "csv")}>
        <TextPreview name="csv" text={resultsCsv(props.race)} />
      </ExportRow>
      <ExportRow
        name="json"
        download={async () => saveText(resultsJson, "application/json", "json")}
      >
        <TextPreview name="json" text={resultsJson(props.race)} />
      </ExportRow>
      <ExportRow
        name="image"
        copy={() => navigator.clipboard.write([new ClipboardItem({ "image/png": image() })])}
        download={async () => save(await image(), exportFileName(props.race, "png"))}
        setting={
          <input
            class={numberField}
            type="number"
            aria-label="places to highlight"
            title="Places to highlight"
            min={0}
            max={placed()}
            value={top()}
            // Redraws the preview on every arrow click or typed digit, not only when the field
            // loses focus.
            onInput={(event) => {
              const value = Number(event.currentTarget.value);
              const allowed = Number.isInteger(value) && value >= 0 && value <= placed();
              if (event.currentTarget.value !== "" && allowed) {
                setTop(value);
              }
            }}
            onChange={(event) => {
              event.currentTarget.value = String(top());
            }}
          />
        }
      >
        <ImagePreview image={image} top={top()} />
      </ExportRow>
    </section>
  );
}

/** Shows one format: its opener, then whichever of setting, copy and download it offers. */
function ExportRow(props: {
  name: string;
  copy?: () => Promise<void>;
  download?: () => Promise<void>;
  /** Fills the space before the buttons, like the image's highlight count. */
  setting?: JSX.Element;
  children: JSX.Element;
}): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const [copied, setCopied] = createSignal<"copied" | "failed" | null>(null);
  const copy = async () => {
    const ok = await (props.copy ?? (() => Promise.reject()))().then(
      () => true,
      () => false,
    );
    setCopied(ok ? "copied" : "failed");
    setTimeout(() => setCopied(null), copiedForMs);
  };
  const copyLabel = () => (copied() ? `${props.name} ${copied()}` : `copy ${props.name}`);

  return (
    <>
      <details
        class={styles.exportDetails}
        data-span={1 + [props.setting, props.copy, props.download].filter((part) => !part).length}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary class={styles.exportSummary}>{props.name}</summary>
        <Show when={open()}>{props.children}</Show>
      </details>
      <Show when={props.setting}>
        <div class={styles.exportSetting}>{props.setting}</div>
      </Show>
      <Show when={props.copy}>
        <Button variant="icon" aria-label={copyLabel()} title={copyLabel()} onClick={copy}>
          <Show when={copied()} fallback={<Copy class={styles.rowIcon} aria-hidden="true" />}>
            {(state) =>
              state() === "copied" ? (
                <Check class={styles.rowIcon} aria-hidden="true" />
              ) : (
                <X class={styles.rowIcon} aria-hidden="true" />
              )
            }
          </Show>
        </Button>
      </Show>
      <Show when={props.download}>
        {(download) => (
          <Button
            variant="icon"
            aria-label={`download ${props.name}`}
            title={`download ${props.name}`}
            onClick={download()}
          >
            <Download class={styles.rowIcon} aria-hidden="true" />
          </Button>
        )}
      </Show>
    </>
  );
}

function TextPreview(props: { name: string; text: string }): JSX.Element {
  return (
    <textarea
      ref={(area) => queueMicrotask(() => area.focus())}
      class={styles.exportText}
      aria-label={`results as ${props.name}`}
      readOnly
      rows={Math.min(12, props.text.split("\n").length)}
      value={props.text}
      onFocus={(event) => event.currentTarget.select()}
    />
  );
}

function ImagePreview(props: { image: () => Promise<Blob>; top: number }): JSX.Element {
  const [url] = createResource<string, number>(
    () => props.top,
    async (_top, { value: previous }) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return URL.createObjectURL(await props.image());
    },
  );
  onCleanup(() => {
    const current = url();
    if (current) {
      URL.revokeObjectURL(current);
    }
  });

  return (
    <Show when={url()}>
      {(src) => (
        <img
          class={styles.exportImage}
          src={src()}
          alt="Race results with the podium highlighted"
        />
      )}
    </Show>
  );
}
