# Product

## Register

product

## Users
Steam Deck owners who also game on a Windows PC, usually streaming from it with Steam Link / Remote Play, sitting on the couch away from the desk. They open the Deck's Quick Access Menu (`…`) mid-game or before a session to do one quick thing to the PC: open or close Steam, set the volume, turn the screen off, or put the PC to sleep. They hold a controller, not a mouse; every control is reached with the D-pad and A.

## Product Purpose
PC Remote is a Decky plugin plus a small Windows agent that turns the Quick Access Menu into a remote for the PC. Success: the player does the task in one or two presses without walking to the PC, always knows whether the PC is reachable, and never triggers a shutdown by accident.

## Brand Personality
Tactile, direct, trustworthy. It should feel like a console remote: big recognisable icons, each kind of action with its own colour, instant feedback when pressed. Confident rather than cute; it still belongs inside SteamOS.

## Anti-references
- A plain list of grey text-only buttons (the first version of this plugin).
- Anything that reads as a separate app pasted into SteamOS: foreign fonts, a theme fighting the Steam UI.

## Design Principles
1. Glanceable state first: the PC's status is the first thing seen, and it is readable at arm's length.
2. One press for the common, a confirmation for the destructive: power actions never fire from a single stray press.
3. Recognise, don't read: every action carries an icon and a colour family, so the player finds it without reading labels.
4. Controller-native: every control is a focusable element in a predictable vertical order; nothing needs touch or a mouse.
5. Quiet when idle, loud when it matters: colour is reserved for state and action families, not decoration.

## Accessibility & Inclusion
Legible contrast on the Deck's 7" 1280×800 screen (WCAG AA for text). Colour is never the only signal: icons and words carry state too. Fully navigable with the controller alone. Motion is short and respects reduced-motion.
