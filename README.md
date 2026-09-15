# BEYOND THE HORIZON — PLAYABLE 1.0

iPhone-first single-file vertical slice.

## What 1.0 adds
- deterministic accumulated simulation steps;
- survival consequences tied to hunger, thirst, energy and temperature;
- material-state model (hardness, strength, flexibility, flammability, wetness, condition);
- tool condition and wear tracking;
- knowledge progression: UNKNOWN → OBSERVED → TESTED → MASTERED;
- persistent world memory for resource extraction and weather/fire events;
- slow ecological regeneration;
- persistent save versioning and backward compatibility with the 0.7 save;
- statistics for distance, resources gathered and days survived;
- proven pointer joystick and keyboard fallback;
- no external libraries or service worker.

## Validation
- JavaScript syntax (`node --check`): PASS
- touch pointer handlers: PASS
- save/load (`localStorage`): PASS
- required 1.0 systems present: PASS
- single HTML dependency model: PASS

This is a playable 1.0 vertical slice, not the full civilization/space simulation.
