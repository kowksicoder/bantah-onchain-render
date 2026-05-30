class AssetLoader {
  static async loadJSON(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Unable to load ${path}: ${response.status}`);
    }
    return response.json();
  }

  static collectImageSources(stageConfig, fighterConfigs) {
    const sources = new Set();

    if (stageConfig.background?.imageSrc) {
      sources.add(stageConfig.background.imageSrc);
    }

    for (const decoration of stageConfig.decorations || []) {
      if (decoration.imageSrc) sources.add(decoration.imageSrc);
    }

    for (const fighter of fighterConfigs) {
      if (fighter.imageSrc) sources.add(fighter.imageSrc);

      for (const sprite of Object.values(fighter.sprites || {})) {
        if (sprite.imageSrc) sources.add(sprite.imageSrc);
      }
    }

    return Array.from(sources);
  }

  static preloadImages(sources) {
    return Promise.all(
      sources.map(
        (src) =>
          new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error(`Unable to load image ${src}`));
            image.src = src;
          }),
      ),
    );
  }
}
