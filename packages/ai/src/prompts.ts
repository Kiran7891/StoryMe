import type { PanelImageRequest, ScriptRequest } from './types.js';

/** Prompt template version — bump on any change; logged with each generation for
 *  reproducibility and prompt-regression testing. */
export const PROMPT_VERSION = 'v1';

const STYLE_DESCRIPTORS: Record<string, string> = {
  manga: 'black-and-white manga, screentones, dynamic action lines, expressive eyes',
  superhero: 'bold American superhero comic, heavy inking, vivid primary colors, halftone shading',
  chibi: 'cute chibi style, big heads, soft pastel colors, rounded shapes',
  noir: 'film-noir comic, high-contrast black and white, dramatic shadows, moody',
  watercolor: 'soft watercolor storybook illustration, gentle washes, warm palette',
};

export function buildScriptPrompt(req: ScriptRequest): { system: string; user: string } {
  const system = [
    'You are a comic-book writer. Write a short, fun, age-appropriate comic script.',
    'Return ONLY valid JSON matching this shape:',
    '{ "title": string, "panels": [{ "scene": string, "dialogue": [{ "speaker": string, "text": string }] }] }',
    `Produce exactly ${req.panelCount} panels.`,
    'Keep dialogue short (fits a speech bubble). No explicit, violent, or unsafe content.',
  ].join(' ');
  const user = [
    `Hero name: ${req.characterName}.`,
    `Art style: ${req.style}.`,
    `Story idea: ${req.prompt}.`,
    `Make ${req.characterName} the clear protagonist in every panel.`,
  ].join('\n');
  return { system, user };
}

export function buildPanelImagePrompt(req: PanelImageRequest): string {
  const style = STYLE_DESCRIPTORS[req.style] ?? req.style;
  return [
    `${style}.`,
    `A single comic panel featuring ${req.characterName} as the main character.`,
    req.scene,
    'Consistent character appearance, clear composition, leave room for a speech bubble.',
  ].join(' ');
}
