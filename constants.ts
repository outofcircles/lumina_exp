
import { Category, AuthorStyle, Language } from './types';

export const CATEGORIES: Category[] = [
  { id: 'science', label: 'Science & Innovation', icon: 'Atom', color: 'bg-blue-100 text-blue-600', description: 'Explorers of the universe and inventors of new things.' },
  { id: 'social', label: 'Social Reform & Service', icon: 'Heart', color: 'bg-red-100 text-red-600', description: 'Heroes who fought for justice, peace, and helping others.' },
  { id: 'sports', label: 'Sports & Adventure', icon: 'Trophy', color: 'bg-yellow-100 text-yellow-600', description: 'Champions of strength, courage, and breaking limits.' },
  { id: 'arts', label: 'Art, Literature & Music', icon: 'Music', color: 'bg-purple-100 text-purple-600', description: 'Creators of beauty, stories, and songs that touch the soul.' },
  { id: 'environment', label: 'Environment & Nature', icon: 'Leaf', color: 'bg-green-100 text-green-600', description: 'Guardians of our planet, animals, and forests.' },
  { id: 'philosophy', label: 'Philosophy & Wisdom', icon: 'BookOpen', color: 'bg-indigo-100 text-indigo-600', description: 'Thinkers who taught us how to live better lives.' },
  { id: 'leadership', label: 'Leadership & Politics', icon: 'Globe', color: 'bg-orange-100 text-orange-600', description: 'Leaders who guided nations and people through dark times.' },
  { id: 'education', label: 'Education & Teaching', icon: 'User', color: 'bg-pink-100 text-pink-600', description: 'Teachers who opened minds and built futures.' },
];

export const SCIENCE_CATEGORIES: Category[] = [
  { id: 'physics', label: 'Physics & Energy', icon: 'Zap', color: 'bg-emerald-100 text-emerald-600', description: 'Forces, motion, light, and the laws of the universe.' },
  { id: 'chemistry', label: 'Chemistry & Matter', icon: 'FlaskConical', color: 'bg-teal-100 text-teal-600', description: 'Elements, reactions, and the building blocks of everything.' },
  { id: 'biology', label: 'Biology & Life', icon: 'Dna', color: 'bg-lime-100 text-lime-600', description: 'Cells, evolution, plants, and the secrets of life.' },
  { id: 'space', label: 'Astronomy & Space', icon: 'Rocket', color: 'bg-indigo-100 text-indigo-600', description: 'Stars, planets, black holes, and the cosmos.' },
  { id: 'tech', label: 'Tech & Computing', icon: 'Cpu', color: 'bg-cyan-100 text-cyan-600', description: 'Computers, AI, internet, and digital inventions.' },
  { id: 'earth', label: 'Earth & Environment', icon: 'Globe', color: 'bg-green-100 text-green-600', description: 'Geology, weather, oceans, and climate.' },
];

export const PHILOSOPHY_CATEGORIES: Category[] = [
  { id: 'ethics', label: 'Ethics & Morality', icon: 'Scale', color: 'bg-violet-100 text-violet-600', description: 'Questions about right, wrong, and justice.' },
  { id: 'governance', label: 'Society & Governance', icon: 'Landmark', color: 'bg-fuchsia-100 text-fuchsia-600', description: 'Democracy, laws, and how we live together.' },
  { id: 'metaphysics', label: 'Reality & Existence', icon: 'Brain', color: 'bg-purple-100 text-purple-600', description: 'What is real? What is the mind? The big questions.' },
  { id: 'eastern', label: 'Eastern Wisdom', icon: 'Lotus', color: 'bg-orange-100 text-orange-600', description: 'Ideas from India, China, and Japan about harmony and life.' },
  { id: 'western', label: 'Western Thought', icon: 'Pillar', color: 'bg-blue-100 text-blue-600', description: 'Logic, reason, and ideas from Greece to modern Europe.' },
  { id: 'religion', label: 'World Religions', icon: 'BookHeart', color: 'bg-rose-100 text-rose-600', description: 'History and core values of major faiths (neutral perspective).' },
];

export const AUTHOR_STYLES: AuthorStyle[] = [
  { 
    id: 'tagore', 
    name: 'Rabindranath Tagore', 
    description: 'Poetic, lyrical, and deeply human.',
    persona: 'The Bard of Bengal',
    era: '1861–1941',
    majorWorks: ['Gitanjali', 'Kabuliwala', 'The Home and the World']
  },
  { 
    id: 'bond', 
    name: 'Ruskin Bond', 
    description: 'Gentle, nature-loving, and simple.',
    persona: 'The Mountain Storyteller',
    era: '1934–Present',
    majorWorks: ['The Blue Umbrella', 'The Room on the Roof', 'Rusty, the Boy from the Hills']
  },
  { 
    id: 'dahl', 
    name: 'Roald Dahl', 
    description: 'Engaging, slightly witty, and full of wonder.',
    persona: 'The Whimsical Weaver',
    era: '1916–1990',
    majorWorks: ['Matilda', 'The BFG', 'Charlie and the Chocolate Factory']
  },
  { 
    id: 'andersen', 
    name: 'Hans Christian Andersen', 
    description: 'Classic fairy tale style with deep morals.',
    persona: 'The Fable Keeper',
    era: '1805–1875',
    majorWorks: ['The Ugly Duckling', 'The Little Mermaid', 'The Emperor’s New Clothes']
  },
  { 
    id: 'angelou', 
    name: 'Maya Angelou', 
    description: 'Rhythmic, powerful, and inspiring.',
    persona: 'The Voice of Soul',
    era: '1928–2014',
    majorWorks: ['I Know Why the Caged Bird Sings', 'On the Pulse of Morning', 'And Still I Rise']
  },
  {
    id: 'shakespeare',
    name: 'William Shakespeare',
    description: 'Dramatic, poetic, using rich metaphors and rhythmic cadence.',
    persona: 'The Bard of Avon',
    era: '1564–1616',
    majorWorks: ['Hamlet', 'Macbeth', 'Romeo and Juliet']
  },
  {
    id: 'homer',
    name: 'Homer',
    description: 'Grand, heroic, using epithets and invocation of muses.',
    persona: 'The Epic Bard',
    era: 'c. 8th Century BC',
    majorWorks: ['The Iliad', 'The Odyssey']
  },
  {
    id: 'twain',
    name: 'Mark Twain',
    description: 'Humorous, down-to-earth, and full of spirited adventure.',
    persona: 'The Folksy Narrator',
    era: '1835–1910',
    majorWorks: ['Tom Sawyer', 'Huckleberry Finn']
  }
];

export const HINDI_AUTHOR_STYLES: AuthorStyle[] = [
  { 
    id: 'premchand', 
    name: 'Munshi Premchand', 
    description: 'Grounded, realistic, simple yet profound language.',
    persona: 'Katha Samrat (Emperor of Stories)',
    era: '1880–1936',
    majorWorks: ['Godaan', 'Idgah', 'Mansarovar']
  },
  { 
    id: 'dinkar', 
    name: 'Ramdhari Singh Dinkar', 
    description: 'Veer Ras - powerful, energetic, and inspiring.',
    persona: 'Rashtra Kavi (National Poet)',
    era: '1908–1974',
    majorWorks: ['Rashmirathi', 'Urvashi', 'Kurukshetra']
  },
  { 
    id: 'kabir', 
    name: 'Kabirdas', 
    description: 'Mystical, doha style, focused on wisdom and truth.',
    persona: 'The Mystic Weaver',
    era: '15th Century',
    majorWorks: ['Bijak', 'Sakhi Granth', 'Kabir Granthawali']
  },
  { 
    id: 'tulsi', 
    name: 'Tulsidas', 
    description: 'Devotional, flowery, and rhythmic Awadhi style.',
    persona: 'The Devotional Bard',
    era: '1511–1623',
    majorWorks: ['Ramcharitmanas', 'Vinaya Patrika', 'Hanuman Chalisa']
  },
  { 
    id: 'gupt', 
    name: 'Maithilisharan Gupt', 
    description: 'Patriotic, cultural, and poetic standard Hindi.',
    persona: 'The Cultural Voice',
    era: '1886–1964',
    majorWorks: ['Saket', 'Yashodhara', 'Bharat-Bharati']
  },
  { 
    id: 'subhadra', 
    name: 'Subhadra Kumari Chauhan', 
    description: 'Heroic, ballad style, famous for Jhansi ki Rani.',
    persona: 'The Heroic Voice',
    era: '1904–1948',
    majorWorks: ['Jhansi Ki Rani', 'Mukul', 'Tridhara']
  },
  {
    id: 'kalidasa',
    name: 'Kalidasa',
    description: 'Rich with nature imagery, ornate similes (Upama), and beauty.',
    persona: 'Kavikulaguru',
    era: 'c. 4th–5th Century CE',
    majorWorks: ['Abhigyan Shakuntalam', 'Meghaduta']
  },
  {
    id: 'surdas',
    name: 'Surdas',
    description: 'Passionate, lyrical, and deeply devotional (Bhakti).',
    persona: 'The Devotional Singer',
    era: 'c. 16th Century',
    majorWorks: ['Sur Sagar', 'Sur Saravali']
  }
];

export const DEFAULT_LANGUAGE = Language.ENGLISH;
