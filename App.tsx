// ... existing imports

// Inside App component...
  const handleItemSelect = async (item: any) => {
    setSelectedItem(item);
    setGeneratedContent(null);
    setStep(AppStep.CONTENT_VIEW);
    setLoadingContent(true);
    setLoadingImages(false);
    setError(null);

    try {
      if (mode === AppMode.STORIES) {
        const profile = item as Profile;
        const englishStyle = AUTHOR_STYLES[Math.floor(Math.random() * AUTHOR_STYLES.length)];
        const hindiStyle = HINDI_AUTHOR_STYLES[Math.floor(Math.random() * HINDI_AUTHOR_STYLES.length)];
        
        // 1. Generate Text First
        const story = await generateStory(profile, englishStyle.name, englishStyle.description, hindiStyle.name, hindiStyle.description);
        setGeneratedContent(story);
        setLoadingContent(false);
        refreshQuota();

        if (selectedCategory) {
             await saveItemToArchive(AppMode.STORIES, profile, story, selectedCategory, { styleName: englishStyle.name, personaName: englishStyle.persona, primaryLanguage: language });
             refreshLibrary();
        }
        
        // 2. Generate Images Sequentially (gentler on API)
        setLoadingImages(true);
        
        // Image A: Main Illustration
        const imageUrl = await generateStoryImage(story.illustrationPrompt, false);
        setGeneratedContent((prev: any) => ({ ...prev, generatedImageUrl: imageUrl }));

        // Image B: Map (Only if first one didn't crash everything)
        const mapUrl = await generateStoryImage(story.geography.mapPrompt, true);
        setGeneratedContent((prev: any) => ({ ...prev, generatedMapUrl: mapUrl }));
        
        setLoadingImages(false);

      } else if (mode === AppMode.CONCEPTS) {
        // ... similar sequential logic for Science
        const scienceItem = item as ScienceItem;
        const entry = await generateScienceEntry(scienceItem);
        setGeneratedContent(entry);
        setLoadingContent(false);
        refreshQuota();

        if (selectedCategory) {
            await saveItemToArchive(AppMode.CONCEPTS, scienceItem, entry, selectedCategory);
            refreshLibrary();
        }

        setLoadingImages(true);
        const img = await generateStoryImage(entry.illustrationPrompt, false);
        setGeneratedContent((prev: any) => ({ ...prev, generatedImageUrl: img }));
        setLoadingImages(false);

      } else if (mode === AppMode.PHILOSOPHIES) {
        // ... similar sequential logic for Philosophy
        const philoItem = item as PhilosophyItem;
        const entry = await generatePhilosophyEntry(philoItem);
        setGeneratedContent(entry);
        setLoadingContent(false);
        refreshQuota();

        if (selectedCategory) {
            await saveItemToArchive(AppMode.PHILOSOPHIES, philoItem, entry, selectedCategory);
            refreshLibrary();
        }

        setLoadingImages(true);
        const img = await generateStoryImage(entry.illustrationPrompt, false);
        setGeneratedContent((prev: any) => ({ ...prev, generatedImageUrl: img }));
        setLoadingImages(false);
      }
    } catch (e) {
      handleError(e, "Could not generate content. Please try again.");
      // If text generation failed, go back. If only images failed, stay on page (handled above by not crashing)
      if (!generatedContent) {
          setStep(AppStep.ITEM_SELECT);
      }
      setLoadingContent(false);
      setLoadingImages(false);
    }
  };
// ... rest of file
