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
    description: 'Poetic, lyrical, and deeply human (Standard English).',
    persona: 'The Bard of Bengal',
    era: '1861–1941',
    majorWorks: ['Gitanjali', 'Kabuliwala', 'The Home and the World']
  },
  { 
    id: 'bond', 
    name: 'Ruskin Bond', 
    description: 'Gentle, nature-loving, and simple storytelling (Standard English).',
    persona: 'The Mountain Storyteller',
    era: '1934–Present',
    majorWorks: ['The Blue Umbrella', 'The Room on the Roof', 'Rusty']
  },
  { 
    id: 'dahl', 
    name: 'Roald Dahl', 
    description: 'Engaging, slightly witty, and full of wonder (Standard English).',
    persona: 'The Whimsical Weaver',
    era: '1916–1990',
    majorWorks: ['Matilda', 'The BFG', 'Charlie and the Chocolate Factory']
  },
  { 
    id: 'andersen', 
    name: 'Hans Christian Andersen', 
    description: 'Classic fairy tale style with deep morals (Standard English).',
    persona: 'The Fable Keeper',
    era: '1805–1875',
    majorWorks: ['The Ugly Duckling', 'The Little Mermaid']
  },
  { 
    id: 'angelou', 
    name: 'Maya Angelou', 
    description: 'Rhythmic, powerful, and inspiring voice (Standard English).',
    persona: 'The Voice of Soul',
    era: '1928–2014',
    majorWorks: ['I Know Why the Caged Bird Sings', 'On the Pulse of Morning']
  },
  {
    id: 'shakespeare',
    name: 'William Shakespeare',
    description: 'Dramatic and poetic, using rich vocabulary but modern grammar.',
    persona: 'The Bard of Avon',
    era: '1564–1616',
    majorWorks: ['Hamlet', 'Macbeth', 'Romeo and Juliet']
  },
  {
    id: 'twain',
    name: 'Mark Twain',
    description: 'Humorous and observant wit. Use Standard English, avoid dialect/phonetic spelling.',
    persona: 'The Witty Observer',
    era: '1835–1910',
    majorWorks: ['Tom Sawyer', 'Huckleberry Finn']
  },
  {
    id: 'rowling',
    name: 'J.K. Rowling',
    description: 'Imaginative, detailed, and engaging modern fantasy style (Standard English).',
    persona: 'The Magic Weaver',
    era: '1965–Present',
    majorWorks: ['Harry Potter Series']
  },
  {
    id: 'cslewis',
    name: 'C.S. Lewis',
    description: 'Clear, allegorical, and intellectually stimulating (Standard English).',
    persona: 'The Narnian Scholar',
    era: '1898–1963',
    majorWorks: ['The Chronicles of Narnia', 'The Screwtape Letters']
  },
  {
    id: 'tolkien',
    name: 'J.R.R. Tolkien',
    description: 'Epic, mythic, and highly descriptive landscape building (Standard English).',
    persona: 'The Myth Maker',
    era: '1892–1973',
    majorWorks: ['The Hobbit', 'The Lord of the Rings']
  },
  {
    id: 'austen',
    name: 'Jane Austen',
    description: 'Witty, observant of social manners, and elegant (Standard English).',
    persona: 'The Society Observer',
    era: '1775–1817',
    majorWorks: ['Pride and Prejudice', 'Emma']
  },
  {
    id: 'hemingway',
    name: 'Ernest Hemingway',
    description: 'Short sentences, direct, punchy, and minimalistic (Standard English).',
    persona: 'The Direct Voice',
    era: '1899–1961',
    majorWorks: ['The Old Man and the Sea', 'A Farewell to Arms']
  },
  {
    id: 'dickens',
    name: 'Charles Dickens',
    description: 'Vivid character descriptions and emotional storytelling (Standard English).',
    persona: 'The Victorian Storyteller',
    era: '1812–1870',
    majorWorks: ['A Christmas Carol', 'Oliver Twist']
  },
  {
    id: 'seuss',
    name: 'Dr. Seuss',
    description: 'Playful, rhythmic, and whimsical (Standard English only).',
    persona: 'The Rhyme Master',
    era: '1904–1991',
    majorWorks: ['The Cat in the Hat', 'The Lorax']
  },
  {
    id: 'wilder',
    name: 'Laura Ingalls Wilder',
    description: 'Simple, warm, pioneer-style storytelling (Standard English).',
    persona: 'The Prairie Voice',
    era: '1867–1957',
    majorWorks: ['Little House on the Prairie']
  },
  {
    id: 'lmontgomery',
    name: 'L.M. Montgomery',
    description: 'Romantic, flowery descriptions of nature and emotions (Standard English).',
    persona: 'The Green Gables Dreamer',
    era: '1874–1942',
    majorWorks: ['Anne of Green Gables']
  },
  {
    id: 'carroll',
    name: 'Lewis Carroll',
    description: 'Nonsensical logic, curious, and playful (Standard English).',
    persona: 'The Wonderland Guide',
    era: '1832–1898',
    majorWorks: ['Alice in Wonderland']
  },
  {
    id: 'verne',
    name: 'Jules Verne',
    description: 'Adventurous, scientific, and visionary (Standard English).',
    persona: 'The Future Voyager',
    era: '1828–1905',
    majorWorks: ['Twenty Thousand Leagues Under the Sea']
  },
  {
    id: 'stevenson',
    name: 'Robert Louis Stevenson',
    description: 'Swashbuckling adventure and suspenseful narrative (Standard English).',
    persona: 'The Treasure Hunter',
    era: '1850–1894',
    majorWorks: ['Treasure Island']
  },
  {
    id: 'hurston',
    name: 'Zora Neale Hurston',
    description: 'Vibrant, folkloric, and soulful (Standard English grammar).',
    persona: 'The Folklore Keeper',
    era: '1891–1960',
    majorWorks: ['Their Eyes Were Watching God']
  }
];

export const HINDI_AUTHOR_STYLES: AuthorStyle[] = [
  { 
    id: 'premchand', 
    name: 'Munshi Premchand', 
    description: 'Grounded, realistic, simple yet profound language.',
    persona: 'Katha Samrat',
    era: '1880–1936',
    majorWorks: ['Godaan', 'Idgah', 'Mansarovar']
  },
  { 
    id: 'dinkar', 
    name: 'Ramdhari Singh Dinkar', 
    description: 'Veer Ras - powerful, energetic, and inspiring.',
    persona: 'Rashtra Kavi',
    era: '1908–1974',
    majorWorks: ['Rashmirathi', 'Urvashi']
  },
  { 
    id: 'kabir', 
    name: 'Kabirdas', 
    description: 'Mystical, direct, focused on wisdom and truth.',
    persona: 'The Mystic Weaver',
    era: '15th Century',
    majorWorks: ['Bijak', 'Sakhi Granth']
  },
  { 
    id: 'tulsi', 
    name: 'Tulsidas', 
    description: 'Devotional, flowery, and rhythmic.',
    persona: 'The Devotional Bard',
    era: '1511–1623',
    majorWorks: ['Ramcharitmanas']
  },
  { 
    id: 'gupt', 
    name: 'Maithilisharan Gupt', 
    description: 'Patriotic, cultural, and poetic standard Hindi.',
    persona: 'The Cultural Voice',
    era: '1886–1964',
    majorWorks: ['Saket', 'Yashodhara']
  },
  { 
    id: 'subhadra', 
    name: 'Subhadra Kumari Chauhan', 
    description: 'Heroic, ballad style, famous for Jhansi ki Rani.',
    persona: 'The Heroic Voice',
    era: '1904–1948',
    majorWorks: ['Jhansi Ki Rani']
  },
  {
    id: 'kalidasa',
    name: 'Kalidasa',
    description: 'Rich with nature imagery and beauty (Translated Style).',
    persona: 'Kavikulaguru',
    era: 'c. 4th Century CE',
    majorWorks: ['Abhigyan Shakuntalam']
  },
  {
    id: 'harivansh',
    name: 'Harivansh Rai Bachchan',
    description: 'Lyrical, rhythmic, and philosophical (Halavad style).',
    persona: 'The Madhushala Poet',
    era: '1907–2003',
    majorWorks: ['Madhushala', 'Agneepath']
  },
  {
    id: 'nirala',
    name: 'Suryakant Tripathi Nirala',
    description: 'Revolutionary, free-verse, and emotional.',
    persona: 'Mahapran',
    era: '1896–1961',
    majorWorks: ['Saroj Smriti', 'Parimal']
  },
  {
    id: 'mahadevi',
    name: 'Mahadevi Varma',
    description: 'Emotive, compassionate (Chhayavaad), focusing on pain and nature.',
    persona: 'Modern Meera',
    era: '1907–1987',
    majorWorks: ['Yama', 'Gillu']
  },
  {
    id: 'shastri',
    name: 'Acharya Chatursen Shastri',
    description: 'Historical fiction style, dramatic and vivid.',
    persona: 'The Historical Narrator',
    era: '1891–1960',
    majorWorks: ['Vaishali Ki Nagarvadhu']
  },
  {
    id: 'bhandari',
    name: 'Mannu Bhandari',
    description: 'Modern, relatable, dealing with middle-class issues.',
    persona: 'The New Wave Voice',
    era: '1931–2021',
    majorWorks: ['Mahabhoj', 'Aapka Bunty']
  },
  {
    id: 'prasad',
    name: 'Jaishankar Prasad',
    description: 'Grand, sanskritized Hindi, romantic and philosophical.',
    persona: 'Chhayavaad Pillar',
    era: '1889–1937',
    majorWorks: ['Kamayani', 'Dhruvaswamini']
  },
  {
    id: 'pant',
    name: 'Sumitranandan Pant',
    description: 'Gentle, nature-centric, and soft spoken.',
    persona: 'Nature’s Poet',
    era: '1900–1977',
    majorWorks: ['Chidambara', 'Pallav']
  },
  {
    id: 'agye',
    name: 'Agyeya (S.H. Vatsyayan)',
    description: 'Modernist, experimental, and psychological.',
    persona: 'The Experimentalist',
    era: '1911–1987',
    majorWorks: ['Shekhar: Ek Jeevani']
  },
  {
    id: 'raghav',
    name: 'Rangeya Raghav',
    description: 'Progressive, detailed, and socially conscious.',
    persona: 'The Progressive Voice',
    era: '1923–1962',
    majorWorks: ['Murdon Ka Teela']
  },
  {
    id: 'parsai',
    name: 'Harishankar Parsai',
    description: 'Satirical, witty, and humorous social commentary.',
    persona: 'The Satirist',
    era: '1924–1995',
    majorWorks: ['Viklang Shraddha Ka Daur']
  },
  {
    id: 'renu',
    name: 'Phanishwar Nath Renu',
    description: 'Regional flavor (Aanchalik), rural, and earthy.',
    persona: 'The Rural Voice',
    era: '1921–1977',
    majorWorks: ['Maila Aanchal']
  }
];

export const DEFAULT_LANGUAGE = Language.ENGLISH;
