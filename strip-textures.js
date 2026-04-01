/**
 * Strip all textures/images from GLB files that contain corrupted JPEG data.
 * Keeps geometry and materials (as untextured), discards all image data.
 */
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const path = require('path');
const fs = require('fs');

const GLB_DIR = path.join(__dirname, 'models/glb');

const TARGETS = [
  '600D X 1200L X 3000H 3L Metal Starter.glb',
  '600D X 1200L X 3000H 3L Plain Starter.glb',
  '600D X 1200L X 3000H 4L Plain Starter.glb',
];

async function stripTextures(filename) {
  const filePath = path.join(GLB_DIR, filename);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

  console.log(`Reading ${filename}...`);
  const document = await io.read(filePath);

  // Remove all textures from materials
  for (const material of document.getRoot().listMaterials()) {
    material.setBaseColorTexture(null);
    material.setMetallicRoughnessTexture(null);
    material.setNormalTexture(null);
    material.setOcclusionTexture(null);
    material.setEmissiveTexture(null);
  }

  // Remove all texture info and images
  for (const texture of document.getRoot().listTextures()) {
    texture.dispose();
  }

  console.log(`Writing ${filename}...`);
  await io.write(filePath, document);
  const size = fs.statSync(filePath).size;
  console.log(`Done: ${(size / 1024 / 1024).toFixed(2)} MB`);
}

(async () => {
  for (const f of TARGETS) {
    try {
      await stripTextures(f);
    } catch (e) {
      console.error(`Failed ${f}:`, e.message);
    }
  }
  console.log('ALL DONE');
})();
