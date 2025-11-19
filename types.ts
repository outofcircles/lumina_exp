
export enum Language {
  ENGLISH = 'English',
  HINDI = 'Hindi'
}

export enum AppMode {
  STORIES = 'STORIES',
  CONCEPTS = 'CONCEPTS',
  PHILOSOPHIES = 'PHILOSOPHIES'
}

export enum AppStep {
  CATEGORY_SELECT = 'CATEGORY_SELECT',
  ITEM_SELECT = 'ITEM_SELECT', // Renamed from PROFILE_SELECT
  CONTENT_VIEW = 'CONTENT_VIEW', // Renamed from STORY_VIEW
  ARCHIVE_LIST = 'ARCHIVE_LIST'
}

export interface Category {
  id: string;
  label: string;
  icon: string; // Lucide icon name
  color: string;
  description: string;
}

// --- STORIES (Profiles) ---
export interface Profile {
  id?: string; // Optional for display logic
  name: string;
  title: string;
  description: string;
  region: string;
  era: string;
  values: string[];
}

export interface StoryContent {
  title: string;
  introduction: string;
  mainBody: string;
  valueReflection: string;
}

export interface GeographyInfo {
  countryName: string;
  funFact: string;
  mapPrompt: string;
}

export interface Story {
  illustrationPrompt: string;
  generatedImageUrl?: string;
  generatedMapUrl?: string;
  generatedAudioUrl?: string;
  english: StoryContent;
  hindi: StoryContent;
  geography: GeographyInfo;
  englishStyle: string;
  hindiStyle: string;
}

// --- SCIENCE CONCEPTS ---
export interface ScienceItem {
  name: string;
  field: string;
  era: string;
  description: string; // Short summary
  tags: string[]; // e.g. "Experiment", "Accidental Discovery"
}

export interface ScienceEntry {
  title: string;
  conceptDefinition: string; // Child-friendly explanation
  humanStory: string; // The narrative of discovery
  experimentOrActivity: string; // A practical example or thought experiment
  sources: string[]; // Wikipedia, Britannica, etc.
  illustrationPrompt: string;
  generatedImageUrl?: string;
}

// --- PHILOSOPHIES ---
export interface PhilosophyItem {
  name: string;
  origin: string;
  era: string;
  coreIdea: string;
  tags: string[];
}

export interface PhilosophyEntry {
  title: string;
  coreIdeaExplanation: string;
  historicalEpisode: string; // A specific event showing impact
  modernrelevance: string;
  sources: string[];
  illustrationPrompt: string;
  generatedImageUrl?: string;
}

export interface AuthorStyle {
  id: string;
  name: string;
  description: string;
  persona: string;
  era: string;
  majorWorks: string[];
}

export interface ArchivedStory {
  id: string;
  // We now store a generic type or union, but for backward compat keeping structure
  // Expanding to support new types
  type: AppMode; 
  itemData: Profile | ScienceItem | PhilosophyItem; 
  content: Story | ScienceEntry | PhilosophyEntry;
  isFavorite?: boolean;
  metadata: {
    categoryId: string;
    styleName?: string; 
    personaName?: string; 
    primaryLanguage?: Language;
    createdAt: number;
  };
}
