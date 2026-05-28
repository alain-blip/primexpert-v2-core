# Verification de coherence croisee — Primexpert V2

Verification transversale entre:
- `CHARTE SUPREME & GOUVERNANCE PRIMEXPERT .rtf`
- `Primexpert Normes d'implantation.rtf`
- `arborescence.md`
- `MEMORY.md`
- `project_canonical_fields.md`
- `project_pipeline_gps.md`
- `README.md`

---

## 1) Resultat executif

- Statut global: **coherent a haute couverture**.
- Alignement fort sur Regle #0 (SSOT `@primexpert/core`, pas de duplication metier UI).
- Pipeline de donnees principal coherent de bout en bout (CRM, residence, finance, messagerie, marche).
- Quelques ecarts de formulation et priorites de normalisation documentaire a corriger pour une coherence parfaite.

## 2) Coherences confirmees

### 2.1 Gouvernance et architecture

- Regle #0 presente et appliquee dans tous les documents techniques.
- SSOT financier ancre sur `residences/{id}/financial/dataV2`.
- Identite ancree sur document racine `residences/{id}`.
- Separation UI vs logique metier maintenue.

### 2.2 CRM et liaisons

- Collection canonique `organizations/{orgId}/contacts` confirmee partout.
- Liaisons bidirectionnelles contacts-residences coherentes.
- Qualification acheteur et import legacy alignes entre `MEMORY.md` et `project_canonical_fields.md`.

### 2.3 Messagerie omnicanale

- SSOT unique `email_threads/messages` coherent entre arborescence, memory, canon fields et pipeline.
- Deprecation de `mailbox_analyses` bien documentee.
- `matchedContactId` et liaison CRM couverts de facon coherente.

### 2.4 Marche / Big Data

- Flux parse -> HITL -> injection confirme.
- Collections top-level marche coherentes.
- Deduplication par empreinte et merge idempotent explicitement repetee et stable.

### 2.5 Fiche residence et modules Workhub

- Les onglets et leur statut se recoupent entre `arborescence.md`, `MEMORY.md` et `README.md`.
- ACM residence, Acces vendeur, Hub Finance et Documents sont alignes sur les memes principes.

## 3) Ecarts et risques documentaires

### 3.1 Lexique "audit" encore present dans certains textes

- Observation: certains docs historiques contiennent encore "audit" dans du texte visible.
- Risque: derive par rapport a la regle linguistique Quebec (visible client/utilisateur).
- Action:
  - Remplacer, dans les zones UI/rapport client: "audit" par verification/conformite/diligence selon contexte.
  - Laisser les identifiants techniques internes non exposes si necessaire.

### 3.2 Duplication d'information entre fichiers

- Observation: `MEMORY.md`, `project_pipeline_gps.md` et `README.md` repetent une partie des memes statuts de chantiers.
- Risque: divergence lors des prochaines mises a jour.
- Action:
  - Definir une source primaire "etat de chantier" (recommande: `MEMORY.md`).
  - Conserver dans les autres docs uniquement un resume et des liens.

### 3.3 Niveau de precision variable selon les documents

- Observation: certains points (billing Stripe J30/J40, VoIP prod) sont notes comme partiels dans un document et backlog dans un autre.
- Risque: ambiguite sur l'etat reel (livre, partiel, en attente de deploiement).
- Action:
  - Uniformiser un format de statut: `NON_COMMENCE | EN_COURS | LIVRE_NON_DEPLOYE | DEPLOYE`.

### 3.4 Conventions region/runtimes Functions

- Observation: regions mentionnees dans plusieurs sections (us-central1, northamerica-northeast1, us-east1).
- Risque: confusion operationnelle au deploiement.
- Action:
  - Ajouter un tableau canonique "Fonction -> region -> dependances secret -> statut deploiement".

## 4) Recommandations de normalisation

- Introduire un "registre des statuts techniques" unique dans `docs/`.
- Lier chaque chantier a un commit de reference + statut deploiement + date.
- Marquer explicitement ce qui est "prod", "parallele", "experimental".
- Harmoniser les formulations conformite pour UI client.
- Maintenir ce rapport comme verification periodique avant deploiement majeur.

## 5) Checklist de correction documentaire (court terme)

- [ ] Purger le mot "audit" des libelles destines utilisateur/client.
- [ ] Ajouter une table canonique des regions Functions.
- [ ] Normaliser les statuts de livraison/deploiement.
- [ ] Reduire les doublons de narrative entre README/pipeline/memory.
- [ ] Pointer tous les resumes vers la source primaire d'etat.

---

Conclusion: la base documentaire est solide et operationnelle; les ajustements restants sont surtout de normalisation, pas de contradiction structurelle.
