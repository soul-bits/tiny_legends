"use client";

import { useCoAgent, useCopilotAction, useCopilotAdditionalInstructions } from "@copilotkit/react-core";
import { CopilotKitCSSProperties, CopilotChat, CopilotPopup } from "@copilotkit/react-ui";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button"
import AppChatHeader, { PopupHeader } from "@/components/canvas/AppChatHeader";
import { X } from "lucide-react"
import CardRenderer from "@/components/canvas/CardRenderer";
import ShikiHighlighter from "react-shiki/web";
import { motion, useScroll, useTransform, useMotionValueEvent } from "motion/react";
import { EmptyState } from "@/components/empty-state";
import { cn, getContentArg } from "@/lib/utils";
import type { AgentState, Item, ItemData, ProjectData, EntityData, NoteData, ChartData, CardType, CharacterData, StorySlideData } from "@/lib/canvas/types";
import { initialState, isNonEmptyAgentState } from "@/lib/canvas/state";
import { projectAddField4Item, projectSetField4ItemText, projectSetField4ItemDone, projectRemoveField4Item, chartAddField1Metric, chartSetField1Label, chartSetField1Value, chartRemoveField1Metric } from "@/lib/canvas/updates";
import useMediaQuery from "@/hooks/use-media-query";
import ItemHeader from "@/components/canvas/ItemHeader";
import NewItemMenu from "@/components/canvas/NewItemMenu";
import StoryView from "@/components/canvas/StoryView";

export default function CopilotKitPage() {
  const { state, setState } = useCoAgent<AgentState>({
    name: "sample_agent",
    initialState,
  });

  // Global cache for the last non-empty agent state
  const cachedStateRef = useRef<AgentState>(state ?? initialState);
  useEffect(() => {
    if (isNonEmptyAgentState(state)) {
      cachedStateRef.current = state as AgentState;
    }
  }, [state]);
  // we use viewState to avoid transient flicker; TODO: troubleshoot and remove this workaround
  const viewState: AgentState = isNonEmptyAgentState(state) ? (state as AgentState) : cachedStateRef.current;

  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [showJsonView, setShowJsonView] = useState<boolean>(false);
  const [showStoryView, setShowStoryView] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<{
    isUploading: boolean;
    fileName: string;
    status: 'uploading' | 'success' | 'error';
    message: string;
  }>({
    isUploading: false,
    fileName: '',
    status: 'uploading',
    message: ''
  });
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const { scrollY } = useScroll({ container: scrollAreaRef });
  const headerScrollThreshold = 64;
  const headerOpacity = useTransform(scrollY, [0, headerScrollThreshold], [1, 0]);
  const [headerDisabled, setHeaderDisabled] = useState<boolean>(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const descTextareaRef = useRef<HTMLInputElement | null>(null);
  const lastCreationRef = useRef<{ type: CardType; name: string; id: string; ts: number } | null>(null);
  const lastChecklistCreationRef = useRef<Record<string, { text: string; id: string; ts: number }>>({});
  const lastMetricCreationRef = useRef<Record<string, { label: string; value: number | ""; id: string; ts: number }>>({});

  useMotionValueEvent(scrollY, "change", (y) => {
    const disable = y >= headerScrollThreshold;
    setHeaderDisabled(disable);
    if (disable) {
      titleInputRef.current?.blur();
      descTextareaRef.current?.blur();
    }
  });

  useEffect(() => {
    console.log("[CoAgent state updated]", state);
  }, [state]);

  // Reset JSON view when there are no items
  useEffect(() => {
    const itemsCount = (viewState?.items ?? []).length;
    if (itemsCount === 0 && showJsonView) {
      setShowJsonView(false);
    }
  }, [viewState?.items, showJsonView]);

  // Reset story view when there are no story items
  useEffect(() => {
    const storyItems = (viewState?.items ?? []).filter(item => item.type === "story");
    if (storyItems.length === 0 && showStoryView) {
      setShowStoryView(false);
    }
  }, [viewState?.items, showStoryView]);



  const getStatePreviewJSON = (s: AgentState | undefined): Record<string, unknown> => {
    const snapshot = (s ?? initialState) as AgentState;
    const { globalTitle, globalDescription, items } = snapshot;
    return {
      globalTitle: globalTitle ?? initialState.globalTitle,
      globalDescription: globalDescription ?? initialState.globalDescription,
      items: items ?? initialState.items,
    };
  };


  // Strengthen grounding: always prefer shared state over chat history
  useCopilotAdditionalInstructions({
    instructions: (() => {
      const items = viewState.items ?? initialState.items;
      const gTitle = viewState.globalTitle ?? "";
      const gDesc = viewState.globalDescription ?? "";
      const summary = items
        .slice(0, 5)
        .map((p: Item) => `id=${p.id} • name=${p.name} • type=${p.type}`)
        .join("\n");
      const fieldSchema = [
        "FIELD SCHEMA (authoritative):",
        "- project.data:",
        "  - field1: string (text)",
        "  - field2: string (select: 'Option A' | 'Option B' | 'Option C'; empty string means unset)",
        "  - field3: string (date 'YYYY-MM-DD')",
        "  - field4: ChecklistItem[] where ChecklistItem={id: string, text: string, done: boolean, proposed: boolean}",
        "- entity.data:",
        "  - field1: string",
        "  - field2: string (select: 'Option A' | 'Option B' | 'Option C'; empty string means unset)",
        "  - field3: string[] (selected tags; subset of field3_options)",
        "  - field3_options: string[] (available tags)",
        "- note.data:",
        "  - field1: string (textarea)",
        "- chart.data:",
        "  - field1: Array<{id: string, label: string, value: number | ''}> with value in [0..100] or ''",
        "- story.data:",
        "  - title: string (story title)",
        "  - slides: Array<{id: string, imageUrl: string, audioUrl?: string, caption?: string, duration?: number}>",
      ].join("\n");
      const toolUsageHints = [
        "TOOL USAGE HINTS:",
        "- To create cards, call createItem with { type: 'project' | 'entity' | 'note' | 'chart' | 'character' | 'story', name?: string } and use returned id.",
        "- Prefer calling specific actions: setProjectField1, setProjectField2, setProjectField3, addProjectChecklistItem, setProjectChecklistItem, removeProjectChecklistItem.",
        "- field2 values: 'Option A' | 'Option B' | 'Option C' | '' (empty clears).",
        "- field3 accepts natural dates (e.g., 'tomorrow', '2025-01-30'); it will be normalized to YYYY-MM-DD.",
        "- Checklist edits accept either the generated id (e.g., '001') or a numeric index (e.g., '1', 1-based).",
        "- For charts, values are clamped to [0..100]; use clearChartField1Value to clear an existing metric value.",
        "- Card subtitle/description keywords (description, overview, summary, caption, blurb) map to setItemSubtitleOrDescription. Never write these to data.field1 for non-note items.",
        "LOOP CONTROL: When asked to 'add a couple' items, add at most 2 and stop. Avoid repeated calls to the same mutating tool in one turn.",
        "RANDOMIZATION: If the user specifically asks for random/mock values, you MAY generate and set them right away using the tools (do not block for more details).",
        "VERIFICATION: After tools run, re-read the latest state and confirm what actually changed.",
      ].join("\n");
      return [
        "ALWAYS ANSWER FROM SHARED STATE (GROUND TRUTH).",
        "If a command does not specify which item to change, ask the user to clarify before proceeding.",
        `Global Title: ${gTitle || "(none)"}`,
        `Global Description: ${gDesc || "(none)"}`,
        "Items (sample):",
        summary || "(none)",
        fieldSchema,
        toolUsageHints,
      ].join("\n");
    })(),
  });

  // Tool-based HITL: choose item
  useCopilotAction({
    name: "choose_item",
    description: "Ask the user to choose an item id from the canvas.",
    available: "remote",
    parameters: [
      { name: "content", type: "string", required: false, description: "Prompt to display." },
    ],
    renderAndWaitForResponse: ({ respond, args }) => {
      const items = viewState.items ?? initialState.items;
      if (!items.length) {
        return (
          <div className="rounded-md border bg-white p-4 text-sm shadow">
            <p>No items available.</p>
          </div>
        );
      }
      let selectedId = items[0].id;
      return (
        <div className="rounded-md border bg-white p-4 text-sm shadow">
          <p className="mb-2 font-medium">Select an item</p>
          <p className="mb-3 text-xs text-gray-600">{getContentArg(args) ?? "Which item should I use?"}</p>
          <select
            className="w-full rounded border px-2 py-1"
            defaultValue={selectedId}
            onChange={(e) => {
              selectedId = e.target.value;
            }}
          >
            {(items).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.id})
              </option>
            ))}
          </select>
          <div className="mt-3 flex justify-end gap-2">
            <button className="rounded border px-3 py-1" onClick={() => respond?.("")}>Cancel</button>
            <button className="rounded border bg-blue-600 px-3 py-1 text-white" onClick={() => respond?.(selectedId)}>Use item</button>
          </div>
        </div>
      );
    },
  });

  // Tool-based HITL: choose card type
  useCopilotAction({
    name: "choose_card_type",
    description: "Ask the user to choose a card type to create.",
    available: "remote",
    parameters: [
      { name: "content", type: "string", required: false, description: "Prompt to display." },
    ],
    renderAndWaitForResponse: ({ respond, args }) => {
      const options: { id: CardType; label: string }[] = [
        { id: "project", label: "Project" },
        { id: "entity", label: "Entity" },
        { id: "note", label: "Note" },
        { id: "chart", label: "Chart" },
        { id: "character", label: "Character" },
      ];
      let selected: CardType | "" = "";
      return (
        <div className="rounded-md border bg-white p-4 text-sm shadow">
          <p className="mb-2 font-medium">Select a card type</p>
          <p className="mb-3 text-xs text-gray-600">{getContentArg(args) ?? "Which type of card should I create?"}</p>
          <select
            className="w-full rounded border px-2 py-1"
            defaultValue=""
            onChange={(e) => {
              selected = e.target.value as CardType;
            }}
          >
            <option value="" disabled>Select an item type…</option>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          <div className="mt-3 flex justify-end gap-2">
            <button className="rounded border px-3 py-1" onClick={() => respond?.("")}>Cancel</button>
            <button
              className="rounded border bg-blue-600 px-3 py-1 text-white"
              onClick={() => selected && respond?.(selected)}
              disabled={!selected}
            >
              Use type
            </button>
          </div>
        </div>
      );
    },
  });

  const updateItem = useCallback(
    (itemId: string, updates: Partial<Item>) => {
      setState((prev) => {
        const base = prev ?? initialState;
        const items: Item[] = base.items ?? [];
        const nextItems = items.map((p) => (p.id === itemId ? { ...p, ...updates } : p));
        return { ...base, items: nextItems } as AgentState;
      });
    },
    [setState]
  );

  const updateItemData = useCallback(
    (itemId: string, updater: (prev: ItemData) => ItemData) => {
      setState((prev) => {
        const base = prev ?? initialState;
        const items: Item[] = base.items ?? [];
        const nextItems = items.map((p) => (p.id === itemId ? { ...p, data: updater(p.data) } : p));
        return { ...base, items: nextItems } as AgentState;
      });
    },
    [setState]
  );

  const deleteItem = useCallback((itemId: string) => {
    setState((prev) => {
      const base = prev ?? initialState;
      const existed = (base.items ?? []).some((p) => p.id === itemId);
      const items: Item[] = (base.items ?? []).filter((p) => p.id !== itemId);
      return { ...base, items, lastAction: existed ? `deleted:${itemId}` : `not_found:${itemId}` } as AgentState;
    });
  }, [setState]);

  // Checklist item local helper removed; Copilot actions handle checklist CRUD

  const toggleTag = useCallback((itemId: string, tag: string) => {
    updateItemData(itemId, (prev) => {
      const anyPrev = prev as { field3?: string[] };
      if (Array.isArray(anyPrev.field3)) {
        const selected = new Set<string>(anyPrev.field3 ?? []);
        if (selected.has(tag)) selected.delete(tag); else selected.add(tag);
        return { ...anyPrev, field3: Array.from(selected) } as ItemData;
      }
      return prev;
    });
  }, [updateItemData]);

  // Remove checklist item local helper removed; use Copilot action instead

  // Helper to generate default data by type
  const defaultDataFor = useCallback((type: CardType): ItemData => {
    switch (type) {
      case "character":
        return {
          name: "New Character",
          description: "A character waiting to be described...",
          traits: ["adventurous"],
          image_url: "",
          source_comic: "",
        } as CharacterData;
      case "story":
        return {
          title: "",
          slides: [],
        } as StorySlideData;
      case "project":
        return {
          field1: "",
          field2: "",
          field3: "",
          field4: [],
          field4_id: 0,
        } as ProjectData;
      case "entity":
        return {
          field1: "",
          field2: "",
          field3: [],
          field3_options: ["Tag 1", "Tag 2", "Tag 3"],
        } as EntityData;
      case "note":
        return { field1: "" } as NoteData;
      case "chart":
        return { field1: [], field1_id: 0 } as ChartData;
      default:
        return { field1: "" } as NoteData;
    }
  }, []);

  const addItem = useCallback((type: CardType, name?: string) => {
    const t: CardType = type;
    let createdId = "";
    setState((prev) => {
      const base = prev ?? initialState;
      const items: Item[] = base.items ?? [];
      // Derive next numeric id robustly from both itemsCreated counter and max existing id
      const maxExisting = items.reduce((max, it) => {
        const parsed = Number.parseInt(String(it.id ?? "0"), 10);
        return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
      }, 0);
      const priorCount = Number.isFinite(base.itemsCreated) ? (base.itemsCreated as number) : 0;
      const nextNumber = Math.max(priorCount, maxExisting) + 1;
      createdId = String(nextNumber).padStart(4, "0");
      const item: Item = {
        id: createdId,
        type: t,
        name: name && name.trim() ? name.trim() : "",
        subtitle: "",
        data: defaultDataFor(t),
      };
      const nextItems = [...items, item];
      return { ...base, items: nextItems, itemsCreated: nextNumber, lastAction: `created:${createdId}` } as AgentState;
    });
    return createdId;
  }, [defaultDataFor, setState]);



  // Frontend Actions (exposed as tools to the agent via CopilotKit)
  useCopilotAction({
    name: "setGlobalTitle",
    description: "Set the global title/name (outside of items).",
    available: "remote",
    parameters: [
      { name: "title", type: "string", required: true, description: "The new global title/name." },
    ],
    handler: ({ title }: { title: string }) => {
      setState((prev) => ({ ...(prev ?? initialState), globalTitle: title }));
    },
  });

  useCopilotAction({
    name: "setGlobalDescription",
    description: "Set the global description/subtitle (outside of items).",
    available: "remote",
    parameters: [
      { name: "description", type: "string", required: true, description: "The new global description/subtitle." },
    ],
    handler: ({ description }: { description: string }) => {
      setState((prev) => ({ ...(prev ?? initialState), globalDescription: description }));
    },
  });

  // Frontend Actions (item-scoped)
  useCopilotAction({
    name: "setItemName",
    description: "Set an item's name/title.",
    available: "remote",
    parameters: [
      { name: "name", type: "string", required: true, description: "The new item name/title." },
      { name: "itemId", type: "string", required: true, description: "Target item id." },
    ],
    handler: ({ name, itemId }: { name: string; itemId: string }) => {
      updateItem(itemId, { name });
    },
  });

  // Set item subtitle
  useCopilotAction({
    name: "setItemSubtitleOrDescription",
    description: "Set an item's description/subtitle (short description or subtitle).",
    available: "remote",
    parameters: [
      { name: "subtitle", type: "string", required: true, description: "The new item description/subtitle." },
      { name: "itemId", type: "string", required: true, description: "Target item id." },
    ],
    handler: ({ subtitle, itemId }: { subtitle: string; itemId: string }) => {
      updateItem(itemId, { subtitle });
    },
  });


  // Note-specific field updates (field numbering)
  useCopilotAction({
    name: "setNoteField1",
    description: "Update note content (note.data.field1).",
    available: "remote",
    parameters: [
      { name: "value", type: "string", required: true, description: "New content for note.data.field1." },
      { name: "itemId", type: "string", required: true, description: "Target item id (note)." },
    ],
    handler: ({ value, itemId }: { value: string; itemId: string }) => {
      updateItemData(itemId, (prev) => {
        const nd = prev as NoteData;
        if (Object.prototype.hasOwnProperty.call(nd, "field1")) {
          return { ...(nd as NoteData), field1: value } as NoteData;
        }
        return prev;
      });
    },
  });

  useCopilotAction({
    name: "appendNoteField1",
    description: "Append text to note content (note.data.field1).",
    available: "remote",
    parameters: [
      { name: "value", type: "string", required: true, description: "Text to append to note.data.field1." },
      { name: "itemId", type: "string", required: true, description: "Target item id (note)." },
      { name: "withNewline", type: "boolean", required: false, description: "If true, prefix with a newline." },
    ],
    handler: ({ value, itemId, withNewline }: { value: string; itemId: string; withNewline?: boolean }) => {
      updateItemData(itemId, (prev) => {
        const nd = prev as NoteData;
        if (Object.prototype.hasOwnProperty.call(nd, "field1")) {
          const existing = (nd.field1 ?? "");
          const next = existing + (withNewline ? "\n" : "") + value;
          return { ...(nd as NoteData), field1: next } as NoteData;
        }
        return prev;
      });
    },
  });

  useCopilotAction({
    name: "clearNoteField1",
    description: "Clear note content (note.data.field1).",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Target item id (note)." },
    ],
    handler: ({ itemId }: { itemId: string }) => {
      updateItemData(itemId, (prev) => {
        const nd = prev as NoteData;
        if (Object.prototype.hasOwnProperty.call(nd, "field1")) {
          return { ...(nd as NoteData), field1: "" } as NoteData;
        }
        return prev;
      });
    },
  });

  useCopilotAction({
    name: "setProjectField1",
    description: "Update project field1 (text).",
    available: "remote",
    parameters: [
      { name: "value", type: "string", required: true, description: "New value for field1." },
      { name: "itemId", type: "string", required: true, description: "Target item id." },
    ],
    handler: ({ value, itemId }: { value: string; itemId: string }) => {
      const safeValue = String((value as unknown as string) ?? "");
      updateItemData(itemId, (prev) => {
        const anyPrev = prev as { field1?: string };
        if (typeof anyPrev.field1 === "string") {
          return { ...anyPrev, field1: safeValue } as ItemData;
        }
        return prev;
      });
    },
  });

  // Project-specific field updates
  useCopilotAction({
    name: "setProjectField2",
    description: "Update project field2 (select).",
    available: "remote",
    parameters: [
      { name: "value", type: "string", required: true, description: "New value for field2." },
      { name: "itemId", type: "string", required: true, description: "Target item id." },
    ],
    handler: ({ value, itemId }: { value: string; itemId: string }) => {
      const safeValue = String((value as unknown as string) ?? "");
      updateItemData(itemId, (prev) => {
        const anyPrev = prev as { field2?: string };
        if (typeof anyPrev.field2 === "string") {
          return { ...anyPrev, field2: safeValue } as ItemData;
        }
        return prev;
      });
    },
  });

  useCopilotAction({
    name: "setProjectField3",
    description: "Update project field3 (date, YYYY-MM-DD).",
    available: "remote",
    parameters: [
      { name: "date", type: "string", required: true, description: "Date in YYYY-MM-DD format." },
      { name: "itemId", type: "string", required: true, description: "Target item id." },
    ],
    handler: (args: { date?: string; itemId: string } & Record<string, unknown>) => {
      const itemId = String(args.itemId);
      const dictArgs = args as Record<string, unknown>;
      const rawInput = (dictArgs["date"]) ?? (dictArgs["value"]) ?? (dictArgs["val"]) ?? (dictArgs["text"]);
      const normalizeDate = (input: unknown): string | null => {
        if (input == null) return null;
        if (input instanceof Date && !isNaN(input.getTime())) {
          const yyyy = input.getUTCFullYear();
          const mm = String(input.getUTCMonth() + 1).padStart(2, "0");
          const dd = String(input.getUTCDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}`;
        }
        const asString = String(input);
        // Already in YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) return asString;
        const parsed = new Date(asString);
        if (!isNaN(parsed.getTime())) {
          const yyyy = parsed.getUTCFullYear();
          const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
          const dd = String(parsed.getUTCDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}`;
        }
        return null;
      };
      const normalized = normalizeDate(rawInput);
      if (!normalized) return;
      updateItemData(itemId, (prev) => {
        const anyPrev = prev as { field3?: string };
        if (typeof anyPrev.field3 === "string") {
          return { ...anyPrev, field3: normalized } as ItemData;
        }
        return prev;
      });
    },
  });

  // Clear project field3 (date)
  useCopilotAction({
    name: "clearProjectField3",
    description: "Clear project field3 (date).",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Target item id." },
    ],
    handler: ({ itemId }: { itemId: string }) => {
      updateItemData(itemId, (prev) => {
        const anyPrev = prev as { field3?: string };
        if (typeof anyPrev.field3 === "string") {
          return { ...anyPrev, field3: "" } as ItemData;
        }
        return prev;
      });
    },
  });

  // Project field4 (checklist) CRUD
  useCopilotAction({
    name: "addProjectChecklistItem",
    description: "Add a new checklist item to a project.",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Target item id (project)." },
      { name: "text", type: "string", required: false, description: "Initial checklist text (optional)." },
    ],
    handler: ({ itemId, text }: { itemId: string; text?: string }) => {
      const norm = (text ?? "").trim();
      // 1) If a checklist item with same text exists, return its id
      const project = (viewState.items ?? initialState.items).find((it) => it.id === itemId);
      if (project && project.type === "project") {
        const list = ((project.data as ProjectData).field4 ?? []);
        const dup = norm ? list.find((c) => (c.text ?? "").trim() === norm) : undefined;
        if (dup) return dup.id;
      }
      // 2) Per-project throttle to avoid rapid duplicates
      const now = Date.now();
      const key = `${itemId}`;
      const recent = lastChecklistCreationRef.current[key];
      if (recent && recent.text === norm && now - recent.ts < 800) {
        return recent.id;
      }
      let createdId = "";
      updateItemData(itemId, (prev) => {
        const { next, createdId: id } = projectAddField4Item(prev as ProjectData, text);
        createdId = id;
        return next;
      });
      lastChecklistCreationRef.current[key] = { text: norm, id: createdId, ts: now };
      return createdId;
    },
  });

  useCopilotAction({
    name: "setProjectChecklistItem",
    description: "Update a project's checklist item text and/or done state.",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Target item id (project)." },
      { name: "checklistItemId", type: "string", required: true, description: "Checklist item id." },
      { name: "text", type: "string", required: false, description: "New text (optional)." },
      { name: "done", type: "boolean", required: false, description: "Done status (optional)." },
    ],
    handler: (args) => {
      const itemId = String(args.itemId ?? "");
      const target = args.checklistItemId ?? args.itemId;
      let targetId = target != null ? String(target) : "";
      const maybeDone = args.done;
      const text: string | undefined = args.text != null ? String(args.text) : undefined;
      const toBool = (v: unknown): boolean | undefined => {
        if (typeof v === "boolean") return v;
        if (typeof v === "string") {
          const s = v.trim().toLowerCase();
          if (s === "true") return true;
          if (s === "false") return false;
        }
        return undefined;
      };
      const done = toBool(maybeDone);
      updateItemData(itemId, (prev) => {
        let next = prev as ProjectData;
        const list = (next.field4 ?? []);
        // If a plain numeric was provided, allow using it as index (0- or 1-based)
        if (!list.some((c) => c.id === targetId) && /^\d+$/.test(targetId)) {
          const n = parseInt(targetId, 10);
          let idx = -1;
          if (n >= 0 && n < list.length) idx = n; // 0-based
          else if (n > 0 && n - 1 < list.length) idx = n - 1; // 1-based
          if (idx >= 0) targetId = list[idx].id;
        }
        if (typeof text === "string") next = projectSetField4ItemText(next, targetId, text);
        if (typeof done === "boolean") next = projectSetField4ItemDone(next, targetId, done);
        return next;
      });
    },
  });

  useCopilotAction({
    name: "removeProjectChecklistItem",
    description: "Remove a checklist item from a project by id.",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Target item id (project)." },
      { name: "checklistItemId", type: "string", required: true, description: "Checklist item id to remove." },
    ],
    handler: ({ itemId, checklistItemId }: { itemId: string; checklistItemId: string }) => {
      updateItemData(itemId, (prev) => projectRemoveField4Item(prev as ProjectData, checklistItemId));
    },
  });

  // Entity field updates and field3 (tags)
  useCopilotAction({
    name: "setEntityField1",
    description: "Update entity field1 (text).",
    available: "remote",
    parameters: [
      { name: "value", type: "string", required: true, description: "New value for field1." },
      { name: "itemId", type: "string", required: true, description: "Target item id (entity)." },
    ],
    handler: ({ value, itemId }: { value: string; itemId: string }) => {
      updateItemData(itemId, (prev) => {
        const anyPrev = prev as { field1?: string };
        if (typeof anyPrev.field1 === "string") {
          return { ...anyPrev, field1: value } as ItemData;
        }
        return prev;
      });
    },
  });

  useCopilotAction({
    name: "setEntityField2",
    description: "Update entity field2 (select).",
    available: "remote",
    parameters: [
      { name: "value", type: "string", required: true, description: "New value for field2." },
      { name: "itemId", type: "string", required: true, description: "Target item id (entity)." },
    ],
    handler: ({ value, itemId }: { value: string; itemId: string }) => {
      updateItemData(itemId, (prev) => {
        const anyPrev = prev as { field2?: string };
        if (typeof anyPrev.field2 === "string") {
          return { ...anyPrev, field2: value } as ItemData;
        }
        return prev;
      });
    },
  });

  useCopilotAction({
    name: "addEntityField3",
    description: "Add a tag to entity field3 (tags) if not present.",
    available: "remote",
    parameters: [
      { name: "tag", type: "string", required: true, description: "Tag to add." },
      { name: "itemId", type: "string", required: true, description: "Target item id (entity)." },
    ],
    handler: ({ tag, itemId }: { tag: string; itemId: string }) => {
      updateItemData(itemId, (prev) => {
        const e = prev as EntityData;
        const current = new Set<string>((e.field3 ?? []) as string[]);
        current.add(tag);
        return { ...e, field3: Array.from(current) } as EntityData;
      });
    },
  });

  useCopilotAction({
    name: "removeEntityField3",
    description: "Remove a tag from entity field3 (tags) if present.",
    available: "remote",
    parameters: [
      { name: "tag", type: "string", required: true, description: "Tag to remove." },
      { name: "itemId", type: "string", required: true, description: "Target item id (entity)." },
    ],
    handler: ({ tag, itemId }: { tag: string; itemId: string }) => {
      updateItemData(itemId, (prev) => {
        const e = prev as EntityData;
        return { ...e, field3: ((e.field3 ?? []) as string[]).filter((t) => t !== tag) } as EntityData;
      });
    },
  });

  // Chart field1 (metrics) CRUD
  useCopilotAction({
    name: "addChartField1",
    description: "Add a new metric (field1 entries).",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Target item id (chart)." },
      { name: "label", type: "string", required: false, description: "Metric label (optional)." },
      { name: "value", type: "number", required: false, description: "Metric value 0..100 (optional)." },
    ],
    handler: ({ itemId, label, value }: { itemId: string; label?: string; value?: number }) => {
      const normLabel = (label ?? "").trim();
      // 1) If a metric with same label exists, return its id
      const item = (viewState.items ?? initialState.items).find((it) => it.id === itemId);
      if (item && item.type === "chart") {
        const list = ((item.data as ChartData).field1 ?? []);
        const dup = normLabel ? list.find((m) => (m.label ?? "").trim() === normLabel) : undefined;
        if (dup) return dup.id;
      }
      // 2) Per-chart throttle to avoid rapid duplicates
      const now = Date.now();
      const key = `${itemId}`;
      const recent = lastMetricCreationRef.current[key];
      const valKey: number | "" = typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : "";
      if (recent && recent.label === normLabel && recent.value === valKey && now - recent.ts < 800) {
        return recent.id;
      }
      let createdId = "";
      updateItemData(itemId, (prev) => {
        const { next, createdId: id } = chartAddField1Metric(prev as ChartData, label, value);
        createdId = id;
        return next;
      });
      lastMetricCreationRef.current[key] = { label: normLabel, value: valKey, id: createdId, ts: now };
      return createdId;
    },
  });

  useCopilotAction({
    name: "setChartField1Label",
    description: "Update chart field1 entry label by index.",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Target item id (chart)." },
      { name: "index", type: "number", required: true, description: "Metric index (0-based)." },
      { name: "label", type: "string", required: true, description: "New metric label." },
    ],
    handler: ({ itemId, index, label }: { itemId: string; index: number; label: string }) => {
      updateItemData(itemId, (prev) => chartSetField1Label(prev as ChartData, index, label));
    },
  });

  useCopilotAction({
    name: "setChartField1Value",
    description: "Update chart field1 entry value by index (0..100).",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Target item id (chart)." },
      { name: "index", type: "number", required: true, description: "Metric index (0-based)." },
      { name: "value", type: "number", required: true, description: "Metric value 0..100." },
    ],
    handler: ({ itemId, index, value }: { itemId: string; index: number; value: number }) => {
      updateItemData(itemId, (prev) => chartSetField1Value(prev as ChartData, index, value));
    },
  });

  // Clear chart metric value by index
  useCopilotAction({
    name: "clearChartField1Value",
    description: "Clear chart field1 entry value by index (sets to empty).",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Target item id (chart)." },
      { name: "index", type: "number", required: true, description: "Metric index (0-based)." },
    ],
    handler: ({ itemId, index }: { itemId: string; index: number }) => {
      updateItemData(itemId, (prev) => chartSetField1Value(prev as ChartData, index, ""));
    },
  });

  useCopilotAction({
    name: "removeChartField1",
    description: "Remove a chart field1 entry by index.",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Target item id (chart)." },
      { name: "index", type: "number", required: true, description: "Metric index (0-based)." },
    ],
    handler: ({ itemId, index }: { itemId: string; index: number }) => {
      updateItemData(itemId, (prev) => chartRemoveField1Metric(prev as ChartData, index));
    },
  });

  useCopilotAction({
    name: "createItem",
    description: "Create a new item.",
    available: "remote",
    parameters: [
      { name: "type", type: "string", required: true, description: "One of: project, entity, note, chart, character." },
      { name: "name", type: "string", required: false, description: "Optional item name." },
    ],
    handler: ({ type, name }: { type: string; name?: string }) => {
      const t = (type as CardType);
      const normalized = (name ?? "").trim();

      // 1) Name-based idempotency: if an item with same type+name exists, return it
      if (normalized) {
        const existing = (viewState.items ?? initialState.items).find((it) => it.type === t && (it.name ?? "").trim() === normalized);
        if (existing) {
          return existing.id;
        }
      }
      // 2) Per-run throttle: avoid duplicate creations within a short window for identical type+name
      const now = Date.now();
      const recent = lastCreationRef.current;
      if (recent && recent.type === t && (recent.name ?? "") === normalized && now - recent.ts < 5000) {
        return recent.id;
      }
      const id = addItem(t, name);
      lastCreationRef.current = { type: t, name: normalized, id, ts: now };
      return id;
    },
  });

  // Frontend action: delete an item by id
  useCopilotAction({
    name: "deleteItem",
    description: "Delete an item by id.",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Target item id." },
    ],
    handler: ({ itemId }: { itemId: string }) => {
      const existed = (viewState.items ?? initialState.items).some((p) => p.id === itemId);
      deleteItem(itemId);
      return existed ? `deleted:${itemId}` : `not_found:${itemId}`;
    },
  });

  // Character actions
  useCopilotAction({
    name: "setCharacterName",
    description: "Set character name.",
    available: "remote",
    parameters: [
      { name: "name", type: "string", required: true, description: "Character name." },
      { name: "itemId", type: "string", required: true, description: "Character id." },
    ],
    handler: ({ name, itemId }: { name: string; itemId: string }) => {
      updateItemData(itemId, (prev) => {
        const cd = prev as CharacterData;
        if (Object.prototype.hasOwnProperty.call(cd, "name")) {
          return { ...cd, name } as CharacterData;
        }
        return prev;
      });
    },
  });

  useCopilotAction({
    name: "setCharacterDescription",
    description: "Set character description.",
    available: "remote",
    parameters: [
      { name: "description", type: "string", required: true, description: "Character description." },
      { name: "itemId", type: "string", required: true, description: "Character id." },
    ],
    handler: ({ description, itemId }: { description: string; itemId: string }) => {
      updateItemData(itemId, (prev) => {
        const cd = prev as CharacterData;
        if (Object.prototype.hasOwnProperty.call(cd, "description")) {
          return { ...cd, description } as CharacterData;
        }
        return prev;
      });
    },
  });

  useCopilotAction({
    name: "addCharacterTrait",
    description: "Add a character trait.",
    available: "remote",
    parameters: [
      { name: "trait", type: "string", required: true, description: "Trait to add." },
      { name: "itemId", type: "string", required: true, description: "Character id." },
    ],
    handler: ({ trait, itemId }: { trait: string; itemId: string }) => {
      updateItemData(itemId, (prev) => {
        const cd = prev as CharacterData;
        if (Object.prototype.hasOwnProperty.call(cd, "traits")) {
          const currentTraits = cd.traits ?? [];
          if (!currentTraits.includes(trait)) {
            return { ...cd, traits: [...currentTraits, trait] } as CharacterData;
          }
        }
        return prev;
      });
    },
  });

  useCopilotAction({
    name: "removeCharacterTrait",
    description: "Remove a character trait.",
    available: "remote",
    parameters: [
      { name: "trait", type: "string", required: true, description: "Trait to remove." },
      { name: "itemId", type: "string", required: true, description: "Character id." },
    ],
    handler: ({ trait, itemId }: { trait: string; itemId: string }) => {
      updateItemData(itemId, (prev) => {
        const cd = prev as CharacterData;
        if (Object.prototype.hasOwnProperty.call(cd, "traits")) {
          const currentTraits = cd.traits ?? [];
          return { ...cd, traits: currentTraits.filter(t => t !== trait) } as CharacterData;
        }
        return prev;
      });
    },
  });

  useCopilotAction({
    name: "setCharacterImageUrl",
    description: "Set character image URL.",
    available: "remote",
    parameters: [
      { name: "image_url", type: "string", required: true, description: "Image URL." },
      { name: "itemId", type: "string", required: true, description: "Character id." },
    ],
    handler: ({ image_url, itemId }: { image_url: string; itemId: string }) => {
      updateItemData(itemId, (prev) => {
        const cd = prev as CharacterData;
        if (Object.prototype.hasOwnProperty.call(cd, "image_url")) {
          return { ...cd, image_url } as CharacterData;
        }
        return prev;
      });
    },
  });

  useCopilotAction({
    name: "setCharacterSourceComic",
    description: "Set character source comic.",
    available: "remote",
    parameters: [
      { name: "source_comic", type: "string", required: true, description: "Source comic." },
      { name: "itemId", type: "string", required: true, description: "Character id." },
    ],
    handler: ({ source_comic, itemId }: { source_comic: string; itemId: string }) => {
      updateItemData(itemId, (prev) => {
        const cd = prev as CharacterData;
        if (Object.prototype.hasOwnProperty.call(cd, "source_comic")) {
          return { ...cd, source_comic } as CharacterData;
        }
        return prev;
      });
    },
  });

  useCopilotAction({
    name: "generateCharacterImage",
    description: "Generate an image for a character using DALL-E and save it locally.",
    available: "remote",
    parameters: [
      { name: "character_name", type: "string", required: true, description: "Character name." },
      { name: "character_description", type: "string", required: true, description: "Character description." },
      { name: "character_traits", type: "string[]", required: true, description: "Character traits array." },
      { name: "itemId", type: "string", required: true, description: "Character id to update with generated image." },
    ],
    handler: async ({ character_name, character_description, character_traits, itemId }: { 
      character_name: string; 
      character_description: string; 
      character_traits: string[]; 
      itemId: string; 
    }) => {
      try {
        // Call the local API to generate the character image
        const response = await fetch('/api/generate-character-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            character_name,
            character_description,
            character_traits,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success && data.image_url) {
          // Update the character with the generated image URL
          updateItemData(itemId, (prev) => {
            const cd = prev as CharacterData;
            if (Object.prototype.hasOwnProperty.call(cd, "image_url")) {
              return { ...cd, image_url: data.image_url } as CharacterData;
            }
            return prev;
          });
          return `Successfully generated and saved image for ${character_name} at ${data.image_url}`;
        } else {
          throw new Error(data.error || 'Failed to generate character image');
        }
      } catch (error) {
        console.error('Error generating character image:', error);
        return `Error generating image for ${character_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  });

  // Story actions
  useCopilotAction({
    name: "setStoryTitle",
    description: "Set story title.",
    available: "remote",
    parameters: [
      { name: "title", type: "string", required: true, description: "Story title." },
      { name: "itemId", type: "string", required: true, description: "Story id." },
    ],
    handler: ({ title, itemId }: { title: string; itemId: string }) => {
      updateItemData(itemId, (prev) => {
        const sd = prev as StorySlideData;
        if (Object.prototype.hasOwnProperty.call(sd, "title")) {
          return { ...sd, title } as StorySlideData;
        }
        return prev;
      });
    },
  });

  useCopilotAction({
    name: "addStorySlide",
    description: "Add a story slide.",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Story id." },
      { name: "caption", type: "string", required: true, description: "Slide caption." },
      { name: "duration", type: "number", required: false, description: "Slide duration in seconds." },
    ],
    handler: ({ itemId, caption, duration = 8 }: { itemId: string; caption: string; duration?: number }) => {
      updateItemData(itemId, (prev) => {
        const sd = prev as StorySlideData;
        if (Object.prototype.hasOwnProperty.call(sd, "slides")) {
          const newSlide = {
            id: `slide-${Date.now()}`,
            imageUrl: "",
            audioUrl: "",
            caption,
            duration
          };
          return { ...sd, slides: [...(sd.slides || []), newSlide] } as StorySlideData;
        }
        return prev;
      });
    },
  });

  useCopilotAction({
    name: "setStorySlideCaption",
    description: "Set story slide caption.",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Story id." },
      { name: "slideId", type: "string", required: true, description: "Slide id." },
      { name: "caption", type: "string", required: true, description: "New slide caption." },
    ],
    handler: ({ itemId, slideId, caption }: { itemId: string; slideId: string; caption: string }) => {
      updateItemData(itemId, (prev) => {
        const sd = prev as StorySlideData;
        if (Object.prototype.hasOwnProperty.call(sd, "slides")) {
          const updatedSlides = (sd.slides || []).map(slide => 
            slide.id === slideId ? { ...slide, caption } : slide
          );
          return { ...sd, slides: updatedSlides } as StorySlideData;
        }
        return prev;
      });
    },
  });

  useCopilotAction({
    name: "setStorySlideDuration",
    description: "Set story slide duration.",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Story id." },
      { name: "slideId", type: "string", required: true, description: "Slide id." },
      { name: "duration", type: "number", required: true, description: "New slide duration in seconds." },
    ],
    handler: ({ itemId, slideId, duration }: { itemId: string; slideId: string; duration: number }) => {
      updateItemData(itemId, (prev) => {
        const sd = prev as StorySlideData;
        if (Object.prototype.hasOwnProperty.call(sd, "slides")) {
          const updatedSlides = (sd.slides || []).map(slide => 
            slide.id === slideId ? { ...slide, duration } : slide
          );
          return { ...sd, slides: updatedSlides } as StorySlideData;
        }
        return prev;
      });
    },
  });

  useCopilotAction({
    name: "removeStorySlide",
    description: "Remove a story slide.",
    available: "remote",
    parameters: [
      { name: "itemId", type: "string", required: true, description: "Story id." },
      { name: "slideId", type: "string", required: true, description: "Slide id." },
    ],
    handler: ({ itemId, slideId }: { itemId: string; slideId: string }) => {
      updateItemData(itemId, (prev) => {
        const sd = prev as StorySlideData;
        if (Object.prototype.hasOwnProperty.call(sd, "slides")) {
          const updatedSlides = (sd.slides || []).filter(slide => slide.id !== slideId);
          return { ...sd, slides: updatedSlides } as StorySlideData;
        }
        return prev;
      });
    },
  });

  // Comic upload action - uses CopilotKit backend tools
  useCopilotAction({
    name: "processUploadedComic",
    description: "Process the most recently uploaded comic file and extract characters from it. Use this when the user wants to process an uploaded file.",
    available: "remote",
    parameters: [],
    handler: async () => {
      // This will be handled by the backend tool process_uploaded_comic
      // The actual file processing happens on the server side
      return "Processing the most recently uploaded comic file...";
    },
  });

  const titleClasses = cn(
    /* base styles */
    "w-full outline-none rounded-md px-2 py-1",
    "bg-transparent placeholder:text-gray-400",
    "ring-1 ring-transparent transition-all ease-out",
    /* hover styles */
    "hover:ring-border",
    /* focus styles */
    "focus:ring-2 focus:ring-accent/50 focus:shadow-sm focus:bg-accent/10",
    "focus:shadow-accent focus:placeholder:text-accent/65 focus:text-accent",
  );

  return (
    <div
      style={{ "--copilot-kit-primary-color": "#2563eb" } as CopilotKitCSSProperties}
      className="h-screen flex flex-col"
    >
      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Sidebar */}
        <aside className="-order-1 max-md:hidden flex flex-col min-w-80 w-[30vw] max-w-120 p-4 pr-0">
          <div className="h-full flex flex-col align-start w-full shadow-lg rounded-2xl border border-sidebar-border overflow-hidden">
            {/* Chat Header */}
            <AppChatHeader />
            {/* File Upload Button */}
            <div className="p-3 border-b border-sidebar-border">
              <input
                type="file"
                accept=".pdf,.txt"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    // Set uploading state
                    setUploadStatus({
                      isUploading: true,
                      fileName: file.name,
                      status: 'uploading',
                      message: 'Uploading comic file...'
                    });

                    try {
                      // Upload the file to get a file path
                      const formData = new FormData();
                      formData.append('file', file);
                      
                      const uploadResponse = await fetch('/api/upload-comic', {
                        method: 'POST',
                        body: formData,
                      });
                      
                      if (uploadResponse.ok) {
                        const uploadResult = await uploadResponse.json();
                        const filePath = uploadResult.filePath;
                        
                        if (filePath) {
                          setUploadStatus({
                            isUploading: false,
                            fileName: file.name,
                            status: 'success',
                            message: 'Comic uploaded successfully! Click "Process Uploaded Comic" to extract characters.'
                          });
                          
                          // Clear success message after 5 seconds
                          setTimeout(() => {
                            setUploadStatus(prev => ({ ...prev, message: '' }));
                          }, 5000);
                        } else {
                          setUploadStatus({
                            isUploading: false,
                            fileName: file.name,
                            status: 'error',
                            message: 'File uploaded but no file path returned.'
                          });
                        }
                      } else {
                        setUploadStatus({
                          isUploading: false,
                          fileName: file.name,
                          status: 'error',
                          message: `Error uploading file: ${uploadResponse.statusText}`
                        });
                      }
                    } catch (error) {
                      setUploadStatus({
                        isUploading: false,
                        fileName: file.name,
                        status: 'error',
                        message: `Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`
                      });
                    }
                  }
                }}
                className="hidden"
                id="chat-file-upload"
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => document.getElementById('chat-file-upload')?.click()}
                disabled={uploadStatus.isUploading}
              >
                {uploadStatus.isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  '📁 Upload Comic File'
                )}
              </Button>
              
              {/* Upload Status Display */}
              {uploadStatus.message && (
                <div className={`mt-2 p-2 rounded-md text-xs ${
                  uploadStatus.status === 'success' 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : uploadStatus.status === 'error'
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  <div className="flex items-center gap-2">
                    {uploadStatus.status === 'success' && '✅'}
                    {uploadStatus.status === 'error' && '❌'}
                    {uploadStatus.status === 'uploading' && '⏳'}
                    <span className="font-medium">{uploadStatus.fileName}</span>
                  </div>
                  <div className="mt-1 text-xs opacity-80">
                    {uploadStatus.message}
                  </div>
                </div>
              )}
            </div>
            {/* Chat Content - conditionally rendered to avoid duplicate rendering */}
            {isDesktop && (
              <CopilotChat
                className="flex-1 overflow-auto w-full"
                labels={{
                  title: "Agent",
                  initial:
                    "👋 Share a brief or ask to extract fields. Changes will sync with the canvas in real time.",
                }}
                suggestions={[
                  // {
                  //   title: "Add a Project",
                  //   message: "Create a new project.",
                  // },
                  // {
                  //   title: "Add an Entity",
                  //   message: "Create a new entity.",
                  // },
                  // {
                  //   title: "Add a Note",
                  //   message: "Create a new note.",
                  // },
                  // {
                  //   title: "Add a Chart",
                  //   message: "Create a new chart.",
                  // },
                  {
                    title: "Process Uploaded Comic",
                    message: "Process the most recently uploaded comic file and extract characters from it.",
                  },
                  {
                    title: "Add a Character",
                    message: "Create a new character.",
                  },
                  // {
                  //   title: "Add a Story",
                  //   message: "Create a new story with slides and audio.",
                  // },
                ]}
              />
            )}
          </div>
        </aside>
        {/* Main Content */}
        <main className="relative flex flex-1 h-full">
          <div ref={scrollAreaRef} className="relative overflow-auto size-full px-4 sm:px-8 md:px-10 py-4">
            <div className={cn(
              "relative mx-auto max-w-7xl h-full min-h-8",
              (showJsonView || showStoryView || (viewState.items ?? []).length === 0) && "flex flex-col",
            )}>
              {/* Global Title & Description (hidden in JSON and Story view) */}
              {!showJsonView && !showStoryView && (
                <motion.div style={{ opacity: headerOpacity }} className="sticky top-0 mb-6">
                  <input
                    ref={titleInputRef}
                    disabled={headerDisabled}
                    value={viewState?.globalTitle ?? initialState.globalTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setState((prev) => ({ ...(prev ?? initialState), globalTitle: e.target.value }))
                    }
                    placeholder="Tiny Legends"
                    className={cn(titleClasses, "text-2xl font-semibold")}
                  />
                  <input
                    ref={descTextareaRef}
                    disabled={headerDisabled}
                    value={viewState?.globalDescription ?? initialState.globalDescription}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setState((prev) => ({ ...(prev ?? initialState), globalDescription: e.target.value }))
                    }
                    placeholder="Bring your favorite comic characters to life and create epic stories that soar beyond imagination"
                    className={cn(titleClasses, "mt-2 text-sm leading-6 resize-none overflow-hidden")}
                  />
                </motion.div>
              )}
              
              {showStoryView ? (
                <StoryView 
                  stories={(viewState.items ?? []).filter(item => item.type === "story")} 
                  onClose={() => setShowStoryView(false)} 
                />
              ) : (viewState.items ?? []).length === 0 ? (
                <EmptyState className="flex-1">
                  <div className="mx-auto max-w-lg text-center">
                    <h2 className="text-lg font-semibold text-foreground">Nothing here yet</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Create your first item to get started.</p>
                    <div className="mt-6 flex justify-center">
                      <NewItemMenu onSelect={(t: CardType) => addItem(t)} align="center" className="md:h-10" />
                    </div>
                  </div>
                </EmptyState>
              ) : (
                <div className="flex-1 py-0 overflow-hidden">
                  {showJsonView ? (
                    <div className="pb-16 size-full">
                      <div className="rounded-2xl border shadow-sm bg-card size-full overflow-auto max-md:text-sm">
                        <ShikiHighlighter language="json" theme="github-light">
                          {JSON.stringify(getStatePreviewJSON(viewState), null, 2)}
                        </ShikiHighlighter>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-6 lg:grid-cols-2 pb-20">
                      {(viewState.items ?? []).map((item) => (
                        <article key={item.id} className="relative rounded-2xl border p-5 shadow-sm transition-colors ease-out bg-card hover:border-accent/40 focus-within:border-accent/60">
                          <button
                            type="button"
                            aria-label="Delete card"
                            className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-card text-gray-400 hover:bg-accent/10 hover:text-accent transition-colors"
                            onClick={() => deleteItem(item.id)}
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <ItemHeader
                            id={item.id}
                            name={item.name}
                            subtitle={item.subtitle}
                            description={""}
                            onNameChange={(v) => updateItem(item.id, { name: v })}
                            onSubtitleChange={(v) => updateItem(item.id, { subtitle: v })}
                          />

                          <div className="mt-6">
                            <CardRenderer item={item} onUpdateData={(updater) => updateItemData(item.id, updater)} onToggleTag={(tag) => toggleTag(item.id, tag)} />
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
        {(viewState.items ?? []).length > 0 ? (
          <div className={cn(
            "absolute left-1/2 -translate-x-1/2 bottom-4",
            "inline-flex rounded-lg shadow-lg bg-card",
            "[&_button]:bg-card [&_button]:w-22 md:[&_button]:h-10",
            "[&_button]:shadow-none! [&_button]:hover:bg-accent",
          )}>
            <Button
              type="button"
              variant="outline"
              className={cn(
                "gap-1.25 text-base font-semibold rounded-l-none",
                "peer-hover:border-l-accent!",
              )}
              onClick={() => setShowJsonView((v) => !v)}
            >
              {showJsonView
                ? "Canvas"
                : <>JSON</>
              }
            </Button>
            {(viewState.items ?? []).filter(item => item.type === "story").length > 0 && (
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "gap-1.25 text-base font-semibold rounded-r-none border-l-0",
                  showStoryView ? "bg-accent text-accent-foreground" : "",
                )}
                onClick={() => setShowStoryView((v) => !v)}
              >
                📚 Story
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}



