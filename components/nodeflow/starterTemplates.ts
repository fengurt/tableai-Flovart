import type { WorkflowTemplate } from './templates';

export const STARTER_WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'starter-image-flow',
    name: 'Image Node',
    nameEn: 'Image Node',
    description: 'Single image card with its own prompt, model, and key',
    descriptionEn: 'Single image card with its own prompt, model, and key',
    icon: 'IMG',
    category: 'utility',
    nodes: [
      {
        id: 'starter_image',
        kind: 'imageGen',
        x: 120,
        y: 180,
        config: { label: 'Image' },
      },
    ],
    edges: [],
  },
];
