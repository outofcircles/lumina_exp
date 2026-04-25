
export type StoryLength = 'short' | 'medium' | 'long';

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
  research?: StoryResearch;
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
  conceptDefinition: string;
  humanStory: string;
  experimentOrActivity: string;
  sources: string[];
  illustrationPrompt: string;
  generatedImageUrl?: string;
  research?: ScienceResearch;
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
  historicalEpisode: string;
  modernrelevance: string;
  sources: string[];
  illustrationPrompt: string;
  generatedImageUrl?: string;
  research?: PhilosophyResearch;
}

export type ReadingLevel = 'young' | 'middle' | 'teen';

export interface AuthorStyle {
  id: string;
  name: string;
  description: string;
  persona: string;
  era: string;
  majorWorks: string[];
  voiceCharacteristics: string[];
  avoidances: string[];
  sampleTone: string;
  ageAlignment: ReadingLevel[];
}

export interface HindiAuthorStyle extends AuthorStyle {
  vocabularyRegister: 'tatsama' | 'tadbhava' | 'modern' | 'mixed-urdu' | 'avadhi';
}

export interface NarratorStyle {
  id: string;
  name: string;
  persona: string;
  era: string;
  description: string;
  voiceCharacteristics: string[];
  avoidances: string[];
  sampleTone: string;
  ageAlignment: ReadingLevel[];
  majorWorks: string[];
}

export interface StoryResearch {
  keyEvents: string[];
  verifiedFacts: string[];
  quotes: string[];
  historicalContext: string;
  sources: string[];
}

export interface ScienceResearch {
  discoveryContext: string;
  keyFigures: string[];
  verifiedFacts: string[];
  realWorldApplications: string[];
  sources: string[];
}

export interface PhilosophyResearch {
  historicalContext: string;
  keyThinkers: string[];
  verifiedFacts: string[];
  societalImpacts: string[];
  sources: string[];
}

export interface ArchivedStory {
  id: string;
  type: AppMode;
  itemData: Profile | ScienceItem | PhilosophyItem;
  content: Story | ScienceEntry | PhilosophyEntry;
  isFavorite?: boolean;
  metadata: {
    categoryId: string;
    styleName?: string;
    personaName?: string;
    primaryLanguage?: Language;
    readingLevel?: ReadingLevel;
    createdAt: number;
  };
}
