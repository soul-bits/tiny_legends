export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  proposed: boolean;
}

export interface LinkItem {
  title: string;
  url: string;
}

export type CardType = "project" | "entity" | "note" | "chart" | "character" | "story";

export interface ProjectData {
  field1: string; // text
  field2: string; // select
  field3: string; // date
  field4: ChecklistItem[]; // checklist
  field4_id: number; // id counter
}

export interface EntityData {
  field1: string; // text
  field2: string; // select
  field3: string[]; // tags
  field3_options: string[]; // options
}

export interface NoteData {
  field1?: string; // textarea
}

export interface ChartMetric {
  id: string;
  label: string;
  value: number | ""; // 0..100
}

export interface CharacterData {
  name: string;
  description: string;
  traits: string[];
  image_url: string;
  source_comic: string;
}

export interface StorySlideData {
  title: string;
  slides: {
    id: string;
    imageUrl: string;
    audioUrl?: string;
    caption?: string;
    duration?: number; // in seconds
  }[];
}

export interface ChartData {
  field1: ChartMetric[]; // metrics
  field1_id: number; // id counter
}

export type ItemData = ProjectData | EntityData | NoteData | ChartData | CharacterData | StorySlideData;

export interface Item {
  id: string;
  type: CardType;
  name: string; // editable title
  subtitle: string; // subtitle shown under the title
  data: ItemData;
}

export interface AgentState {
  items: Item[];
  globalTitle: string;
  globalDescription: string;
  lastAction?: string;
  itemsCreated: number;
}




