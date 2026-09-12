# Studio character assets

Generated with OpenAI ImageGen for this project on 2026-09-12. These fictional
adult teammates represent workflow roles. They are not portraits of real people.

## Art direction

Eight full-body 3D-rendered office teammates in one consistent family. Warm matte
clay/vinyl materials, softly rounded adult proportions, expressive faces, soft
upper-left daylight and a slightly elevated three-quarter camera. Muted cream,
sage, teal, terracotta and berry accents to match the existing wood-and-cream
studio. Each role has a distinct silhouette, hairstyle, outfit and work prop.
Strict four-column by two-row atlas, one isolated character in each cell, uniform
scale, full bodies and feet visible, real transparent alpha, no labels or scenery.
Requested canvas: 2048 × 1024. Actual generated canvas: 1774 × 887.

| Cell | Role | Applied identity |
| --- | --- | --- |
| 1, 1 | Explorer | Blue chore jacket, satchel, folded map |
| 1, 2 | Analyzer | Teal cardigan, round glasses, tablet |
| 1, 3 | Architect | Rose overshirt, black bob, blueprint |
| 1, 4 | Developer | Sage hoodie, headphones, laptop |
| 2, 1 | Operator | Ochre utility vest, beard, tool case |
| 2, 2 | Validator | Terracotta cardigan, glasses, clipboard |
| 2, 3 | Connector | Lavender jacket, natural curls, cable |
| 2, 4 | Liaison | Berry blazer, notebook, coffee |

The generated atlas was inspected before extraction. Measured column boundaries
are 0, 444, 887, 1331, 1774; row boundaries are 0, 444, 887. Each complete cell was
contained in a 384 × 384 transparent square without stretching, then encoded as
WebP at quality 90 / alpha quality 100. The eight runtime sprites total 201,004
bytes. `team-atlas.webp` preserves the complete lineup for design reference and
is not requested by the app. No external images or generation service is needed
at runtime. Artwork is distributed with this MIT-licensed project.

These are transparent 3D renders, not mesh or skeletal animation files. The
application uses CSS for restrained status motion and crops the same sprite into
directory/detail portraits. Foot anchors live in `studioAgents.ts`.
