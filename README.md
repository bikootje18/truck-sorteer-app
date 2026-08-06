# Truck Sorteren

PWA voor het uitsorteren van gemixte pallets naar uniforme stapels
(1 sort / 1 batch / 1 THT), op een Zebra Android handscanner.

## Nieuwe vrachtwagen toevoegen

1. Geef het Excel-bestand aan Claude in de projectmap.
2. `npm run parse` (regenereert `src/data/loads.json`).
3. Commit + push naar `main` → GitHub Actions deployt automatisch.
4. Open de app op de Zebra met internet → de nieuwe truck staat erin.
   Voortgang en geleerde barcodes blijven bewaard.

## Geleerde barcodes veiligstellen

Instellingen → "Exporteer barcodelijst" → plak de JSON in de chat met Claude.
Claude zet hem in `src/data/eanmap.json`; vanaf de volgende deploy overleeft
de lijst een reset van het apparaat.

## Ontwikkelen

- `npm run dev` — lokale server
- `npm test -- --run` — alle tests
- `npm run parse` — Excel → loads.json
- `npm run icons` — PWA-iconen regenereren

## Eerste installatie op de Zebra

1. Open de GitHub Pages URL in Chrome op de Zebra.
2. Menu ⋮ → "App installeren" / "Toevoegen aan startscherm".
3. Controleer DataWedge: keystroke output aan, suffix = Enter.
4. Test één scan; werkt het, dan werkt de app daarna ook offline.

## Handmatige apparaat-checklist (eerste gebruik)

- [ ] Scan landt in het invoerveld zonder dat het toetsenbord opent
- [ ] Enter- én Tab-suffix werken
- [ ] Onbekende barcode → leerscherm → daarna direct het stapelnummer
- [ ] Trilling/geluid bij scan (indien ondersteund)
- [ ] Vliegtuigmodus aan → app blijft werken (PWA offline)
- [ ] App herstarten → voortgang staat er nog
