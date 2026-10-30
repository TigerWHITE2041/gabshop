import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';

import { storage } from './firebase-config.js';
import {
  ref,
  uploadBytes,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-storage.js';

import { initialiserLogoLiquide } from './logo-liquid.js';


// =========================================================
// HEADER (AVEC FILTRE DE PRIX ENTRE CONTACT ET COMPTE)
// =========================================================

document.getElementById('site-header').innerHTML = `
<header>
  <div class="header-inner">

    <a class="brand" href="index.html">
      <span class="logo-liquid" id="logo-liquid">
        <img src="LogoImage.png" alt="3D Commande" style="height: 80px; width: auto; vertical-align: middle;">
      </span>
    </a>

    <nav class="main-nav" aria-label="Navigation principale">
      <ul>

        <li>
          <button
            class="nav-link"
            id="menu-collections"
            aria-haspopup="true"
            aria-expanded="false"
          >
            Collections

            <svg class="caret" viewBox="0 0 10 10" fill="none">
              <path
                d="M2 3.5L5 6.5L8 3.5"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          <div
            class="dropdown"
            id="dropdown-collections"
            role="menu"
            aria-labelledby="menu-collections"
          >
            <div id="collections-dynamiques"></div>

            <div class="dropdown-divider"></div>

            <a href="boutique.html" role="menuitem">
              Tout voir
            </a>
          </div>
        </li>

        <li>
          <a id="vipplus-dropdown" class="nav-link" href="vip-plus.html">
            VIP+
          </a>
        </li>

        <li>
          <a id="commande-dropdown" class="nav-link" href="commande.html">
            Commande personnalisée
          </a>
        </li>

        <li>
          <a id="boutique-dropdown" class="nav-link" href="boutique.html">
            Boutique
          </a>
        </li>

        <li>
          <a id="condition-dropdown" class="nav-link" href="condition.html">
            Conditions d'utilisation
          </a>
        </li>

        <li>
          <a id="contact-dropdown" class="nav-link" href="contact.html">
            Contact
          </a>
        </li>

      </ul>
    </nav>

    <!-- Filtre de Prix dans le Header -->
    <div class="header-price-filter">
      <span class="filter-label">Prix :</span>
      <input type="number" id="prix-min" placeholder="Min €" min="0" step="1" />
      <span>-</span>
      <input type="number" id="prix-max" placeholder="Max €" min="0" step="1" />
      <button type="button" id="btn-filtrer-prix" class="btn-filter-apply">OK</button>
    </div>

    <div class="header-actions">

      <div class="account-header" id="account-header">
        <a href="portail-compte.html" class="header-account">
          Compte
        </a>
      </div>

      <a href="panier.html" class="header-account" id="cart-link">
        Panier (<span id="cart-count">0</span>)
      </a>

    </div>

  </div>
</header>
`;

initialiserLogoLiquide();


// =========================================================
// INITIALISATION DU FILTRE DE PRIX DU HEADER
// =========================================================

(function initialiserFiltrePrixHeader() {
  const btnFiltrer = document.getElementById('btn-filtrer-prix');
  const inputMin = document.getElementById('prix-min');
  const inputMax = document.getElementById('prix-max');

  if (!btnFiltrer) return;

  // Pré-remplir les champs si la page contient déjà des paramètres de filtre dans l'URL
  const params = new URLSearchParams(window.location.search);
  if (params.has('minPrix')) inputMin.value = params.get('minPrix');
  if (params.has('maxPrix')) inputMax.value = params.get('maxPrix');

  btnFiltrer.addEventListener('click', function() {
    const min = inputMin.value.trim();
    const max = inputMax.value.trim();

    const searchParams = new URLSearchParams(window.location.search);

    if (min) searchParams.set('minPrix', min);
    else searchParams.delete('minPrix');

    if (max) searchParams.set('maxPrix', max);
    else searchParams.delete('maxPrix');

    // Redirection vers boutique.html avec les filtres
    window.location.href = `boutique.html?${searchParams.toString()}`;
  });
})();


// =========================================================
// MENU COLLECTIONS
// =========================================================

(function() {

  const btn = document.getElementById('menu-collections');
  const dropdown = document.getElementById('dropdown-collections');

  function closeDropdown() {
    dropdown.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }

  function toggleDropdown() {
    const isOpen = dropdown.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
  }

  if (btn && dropdown) {
    btn.addEventListener('click', function(event) {
      event.stopPropagation();
      toggleDropdown();
    });

    document.addEventListener('click', function(event) {
      if (!dropdown.contains(event.target) && event.target !== btn) {
        closeDropdown();
      }
    });

    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        closeDropdown();
      }
    });
  }

})();


// =========================================================
// PRODUITS DU CATALOGUE (Firestore, collection "produits")
// =========================================================

export async function obtenirProduits() {
  const instantane = await getDocs(collection(db, 'produits'));
  return instantane.docs.map(function(document) {
    return { id: document.id, ...document.data() };
  });
}

export function ecouterProduits(callback) {
  return onSnapshot(
    collection(db, 'produits'),
    function(instantane) {
      const produits = instantane.docs.map(function(document) {
        return { id: document.id, ...document.data() };
      });
      callback(produits);
    },
    function(erreur) {
      console.error('Impossible de suivre les produits en direct :', erreur);
    }
  );
}

export async function obtenirProduit(id) {
  const instantane = await getDoc(doc(db, 'produits', id));
  return instantane.exists()
    ? { id: instantane.id, ...instantane.data() }
    : null;
}

async function genererSlugUnique(nomCollection, texte) {
  const base = texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'article';

  let slug = base;
  let compteur = 2;

  while ((await getDoc(doc(db, nomCollection, slug))).exists()) {
    slug = base + '-' + compteur;
    compteur += 1;
  }

  return slug;
}

export async function ajouterProduit(produit) {
  const id = await genererSlugUnique('produits', produit.nom);
  await setDoc(doc(db, 'produits', id), produit);
  return id;
}

export async function importerProduitAvecId(id, produit) {
  await setDoc(doc(db, 'produits', id), produit);
  return id;
}

export async function modifierProduit(id, donnees) {
  await updateDoc(doc(db, 'produits', id), donnees);
}

export async function supprimerProduit(id) {
  await deleteDoc(doc(db, 'produits', id));
}

export function formaterPrixProduit(produit, role = 'membre') {
  let base = Number(produit.prixBase) || 0;
  const taxes = Number(produit.taxes) || 0;
  const baseOriginale = base;

  if (role === 'vip_gratuit') {
    base = base * 0.80;
  } else if (role === 'vip_payant') {
    base = base * 0.50;
  }

  const total = base + taxes;

  function euros(nombre) {
    return nombre.toFixed(2).replace('.', ',') + ' €';
  }

  if (role === 'vip_gratuit' || role === 'vip_payant') {
    const tauxReduction = role === 'vip_gratuit' ? '-20%' : '-50%';
    const classeBadge = role === 'vip_payant' ? 'role-vip-payant' : 'role-vip-gratuit';

    return (
      `<s>${euros(baseOriginale)}</s> <strong>${euros(total)}</strong> ` +
      `<span class="account-role-badge ${classeBadge}">${tauxReduction}</span> ` +
      `<span class="price-detail">(${euros(base)} + taxes (${taxes.toFixed(2).replace('.', ',')}€))</span>`
    );
  }

  return (
    euros(total) +
    ' <span class="price-detail">(' +
    euros(base) + ' + taxes (' +
    taxes.toFixed(2).replace('.', ',') + '€))</span>'
  );
}

export function filtrerProduitsParCollection(produits, collectionId) {
  if (!collectionId) {
    return produits;
  }

  return produits.filter(function(produit) {
    if (Array.isArray(produit.collections)) {
      return produit.collections.includes(collectionId);
    }
    return produit.collection === collectionId;
  });
}

export function filtrerProduitsParPrix(produits, minPrix, maxPrix) {
  const min = parseFloat(minPrix);
  const max = parseFloat(maxPrix);

  return produits.filter(function(produit) {
    const prixTotal = (Number(produit.prixBase) || 0) + (Number(produit.taxes) || 0);

    if (!isNaN(min) && prixTotal < min) return false;
    if (!isNaN(max) && prixTotal > max) return false;

    return true;
  });
}


// =========================================================
// ONGLETS "COLLECTIONS" DU MENU
// =========================================================

export async function obtenirCollections() {
  const instantane = await getDocs(
    query(collection(db, 'collectionsMenu'), orderBy('ordre'))
  );

  return instantane.docs.map(function(document) {
    return { id: document.id, ...document.data() };
  });
}

export async function ajouterCollection(collectionInfo) {
  const id = await genererSlugUnique('collectionsMenu', collectionInfo.label);
  await setDoc(doc(db, 'collectionsMenu', id), collectionInfo);
  return id;
}

export async function modifierCollection(id, donnees) {
  await updateDoc(doc(db, 'collectionsMenu', id), donnees);
}

export async function supprimerCollection(id) {
  await deleteDoc(doc(db, 'collectionsMenu', id));
}

(async function chargerOngletsCollectionsMenu() {
  const conteneur = document.getElementById('collections-dynamiques');
  if (!conteneur) return;

  try {
    const collections = await obtenirCollections();
    conteneur.innerHTML = collections
      .map(function(item) {
        return `
          <a href="boutique.html?collection=${encodeURIComponent(item.id)}" role="menuitem">
            ${echapperHTML(item.label)}
          </a>
        `;
      })
      .join('');
  } catch (erreur) {
    console.error('Impossible de charger les onglets de collections :', erreur);
  }
})();


// =========================================================
// GESTION DES COULEURS (Firestore, collection "couleurs")
// =========================================================

export async function obtenirCouleurs() {
  const instantane = await getDocs(collection(db, 'couleurs'));
  return instantane.docs.map(function(docSnap) {
    return { id: docSnap.id, ...docSnap.data() };
  });
}

export async function ajouterCouleur(donnees) {
  return await addDoc(collection(db, 'couleurs'), donnees);
}

export async function modifierCouleur(id, donnees) {
  const docRef = doc(db, 'couleurs', id);
  return await updateDoc(docRef, donnees);
}

export async function supprimerCouleur(id) {
  const docRef = doc(db, 'couleurs', id);
  return await deleteDoc(docRef);
}


// =========================================================
// GESTION DES CONDITIONS (Firestore)
// =========================================================

export async function obtenirConditions() {
  try {
    const docSnap = await getDoc(doc(db, 'page_conditions', 'contenu'));
    if (docSnap.exists()) {
      return docSnap.data().sections || null;
    }
  } catch (e) {
    console.error('Erreur lors de la récupération des conditions :', e);
  }
  return null;
}

export async function enregistrerConditions(sections) {
  await setDoc(doc(db, 'page_conditions', 'contenu'), {
    sections: sections,
    derniereMiseAJour: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  });
}


// =========================================================
// GESTION ET AFFICHAGE DES PUBS LATÉRALES (Firestore)
// =========================================================

export async function obtenirPubs() {
  try {
    const docSnap = await getDoc(doc(db, 'pubs', 'bandeaux'));
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (e) {
    console.error('Erreur lors de la récupération des pubs :', e);
  }
  return null;
}

export async function enregistrerPubs(donnees) {
  await setDoc(doc(db, 'pubs', 'bandeaux'), donnees);
}

(async function afficherPubsLaterales() {
  const pubs = await obtenirPubs();
  if (!pubs) return;

  document.querySelectorAll('.pub-laterale').forEach(el => el.remove());

  if (pubs.imageGauche && pubs.imageGauche.trim() !== '') {
    const pubGauche = document.createElement('div');
    pubGauche.className = 'pub-laterale pub-gauche';
    const imgHTML = `<img src="${pubs.imageGauche}" alt="Publicité">`;
    pubGauche.innerHTML = pubs.lienGauche 
      ? `<a href="${pubs.lienGauche}" target="_blank" rel="noopener">${imgHTML}</a>`
      : imgHTML;
    document.body.appendChild(pubGauche);
  }

  if (pubs.imageDroite && pubs.imageDroite.trim() !== '') {
    const pubDroite = document.createElement('div');
    pubDroite.className = 'pub-laterale pub-droite';
    const imgHTML = `<img src="${pubs.imageDroite}" alt="Publicité">`;
    pubDroite.innerHTML = pubs.lienDroit 
      ? `<a href="${pubs.lienDroit}" target="_blank" rel="noopener">${imgHTML}</a>`
      : imgHTML;
    document.body.appendChild(pubDroite);
  }
})();


// =========================================================
// SYSTÈME DE RÔLES ET UTILISATEURS (Firestore)
// =========================================================

export async function obtenirUtilisateurFirestore(uid) {
  try {
    const userDocRef = doc(db, 'utilisateurs', uid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      return userDoc.data();
    }
  } catch (e) {
    console.error('Erreur Firestore :', e);
  }
  return null;
}

export async function obtenirRoleUtilisateur(utilisateur) {
  if (!utilisateur) return 'membre';
  const data = await obtenirUtilisateurFirestore(utilisateur.uid);
  return data?.role || 'membre';
}

export function obtenirInformationsRole(role) {
  switch (role) {
    case 'admin':
      return { nom: 'ADMIN', symbole: '👑', classe: 'role-admin' };
    case 'vip_gratuit':
      return { nom: 'VIP', symbole: '⭐', classe: 'role-vip-gratuit' };
    case 'vip_payant':
      return { nom: 'VIP+', symbole: '💎', classe: 'role-vip-payant' };
    default:
      return { nom: 'Membre', symbole: '', classe: 'role-membre' };
  }
}


// =========================================================
// DÉCONNEXION ET AFFICHAGE COMPTE
// =========================================================

async function deconnecter() {
  try {
    await signOut(auth);
    afficherCompte(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (erreur) {
    console.error('Erreur lors de la déconnexion :', erreur);
  }
}

async function afficherCompte(utilisateur) {
  const accountHeader = document.getElementById('account-header');
  const lienVipPlus = document.getElementById('vipplus-dropdown');

  if (!utilisateur) {
    if (lienVipPlus) lienVipPlus.href = 'vip-plus.html';
    if (!accountHeader) return;
    accountHeader.innerHTML = `
      <a href="portail-compte.html" class="header-account">
        Compte
      </a>
    `;
    return;
  }

  const role = await obtenirRoleUtilisateur(utilisateur);

  if (lienVipPlus) {
    lienVipPlus.href = (role === 'vip_payant') ? 'vip.html' : 'vip-plus.html';
  }

  const informationsRole = obtenirInformationsRole(role);
  const pseudo = utilisateur.displayName || utilisateur.email.split('@')[0];

  accountHeader.innerHTML = `
    <button type="button" class="header-account account-user-button" id="account-user-button" aria-expanded="false">
      ${echapperHTML(pseudo)}
      ${
        role !== 'membre'
          ? `<span class="account-role-badge ${informationsRole.classe}">${informationsRole.symbole}${informationsRole.nom}</span>`
          : ''
      }
    </button>

    <div class="account-dropdown" id="account-dropdown">
      <div class="account-dropdown-user">
        Connecté en tant que <strong>${echapperHTML(pseudo)}</strong>
        <span style="display: block; margin-top: 5px; font-size: 0.78rem; opacity: 0.75;">
          ${echapperHTML(utilisateur.email)}
        </span>
      </div>

      <div class="dropdown-divider"></div>

      <div style="padding: 8px 12px 10px; font-size: 0.8rem; color: var(--ink-soft);">
        Statut :
        <a href="${
          role === 'admin'
            ? 'admin-status.html'
            : role === 'vip_payant'
            ? 'vip.html'
            : role === 'vip_gratuit'
            ? 'free-vip.html'
            : 'membre.html'
        }" class="${informationsRole.classe}">
          ${informationsRole.symbole} ${informationsRole.nom}
        </a>
      </div>

      <div class="dropdown-divider"></div>

      <a href="compte.html">Mon compte</a>
      ${role === 'admin' ? `<a href="admin.html">Administration</a>` : ''}

      <button type="button" id="logout-button" class="deconnexion-button">
        Déconnexion
      </button>
    </div>
  `;

  const boutonCompte = document.getElementById('account-user-button');
  const menuCompte = document.getElementById('account-dropdown');
  const boutonDeconnexion = document.getElementById('logout-button');

  if (boutonCompte && menuCompte) {
    boutonCompte.addEventListener('click', function(event) {
      event.stopPropagation();
      const ouvert = menuCompte.classList.toggle('open');
      boutonCompte.setAttribute('aria-expanded', String(ouvert));
    });

    document.addEventListener('click', function(event) {
      if (!menuCompte.contains(event.target) && event.target !== boutonCompte) {
        menuCompte.classList.remove('open');
        boutonCompte.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (boutonDeconnexion) {
    boutonDeconnexion.addEventListener('click', deconnecter);
  }
}

function echapperHTML(texte) {
  const element = document.createElement('div');
  element.textContent = texte;
  return element.innerHTML;
}


// =========================================================
// EASTER EGG INVISIBLE (POSITION ALÉATOIRE PAR COMPTE, UNIQUE)
// =========================================================

function genererPositionDepuisUID(uid) {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash << 5) - hash + uid.charCodeAt(i);
    hash |= 0;
  }

  const absHash = Math.abs(hash);
  const left = 10 + (absHash % 76);
  const top = 15 + ((Math.floor(absHash / 100)) % 70);

  return { top: top + 'vh', left: left + 'vw' };
}

async function initialiserEasterEgg(utilisateur) {
  if (!utilisateur) return;

  const userDoc = await obtenirUtilisateurFirestore(utilisateur.uid);
  if (userDoc && userDoc.easterEggTrouve === true) return;

  const pos = genererPositionDepuisUID(utilisateur.uid);

  const egg = document.createElement('button');
  egg.type = 'button';
  egg.className = 'easter-egg-zone';
  egg.style.top = pos.top;
  egg.style.left = pos.left;
  egg.setAttribute('aria-label', '');

  egg.addEventListener('click', async function() {
    console.log("Easter egg trouvé !");

    const produitEasterEgg = {
      id: 'mini-dragon-easter-egg',
      nom: 'Mini dragon',
      description: 'Un mini dragon stylé et mignon',
      prix: '<strong>0,00 €</strong> <span class="price-detail">(0,00 € + taxes (0,00€))</span>',
      prixBase: 0,
      taxes: 0,
      collections: ['nouveautes-2026'],
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAakAAAFwCAYAAAACHYS8AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAAEnQAABJ0Ad5mH3gAAP+lSURBVHhe7L15oGVFdS/8q6q9z7lTj0BDdzM0MwoIiOCcqIDzkGjiSzR5iVET9T3n5EWN74UYNZoY51nQmC8+Y+JziCIqiigqiowyjz3Q89x3OufsXVXr+2Otql17n3Nu324aEO0fln3uHmrXuFatVWutUqtXbydAQXkAUPAEKE8g5eGVh9MAAWhnOXTpYZ2FMQZeEQBAkYKGglIE0hZkgJ71yFQRyBAMAA0oDjIajEnmuoUhBOf4XGgC85AkoAEoZAB7WOxCAzBgQCIoArRVAGoqAsizhnIM2BgAZTKahNMF7C688SAGKNBRpwBNIaaSQqvBvANoDmgikCFZ7lJrgQTCkQDAgqPis8YC2D',
      imageAlt: 'Mini dragon',
      lien: 'boutique.html',
      quantite: 1
    };

    try {
      await ajouterAuPanier(utilisateur.uid, produitEasterEgg);

      await setDoc(doc(db, 'utilisateurs', utilisateur.uid), {
        easterEggTrouve: true
      }, { merge: true });

      egg.remove();
    } catch (e) {
      console.error("Erreur lors du traitement de l'easter egg :", e);
    }
  });

  document.body.appendChild(egg);
}


// =========================================================
// SURVEILLER LA CONNEXION FIREBASE
// =========================================================

let utilisateurActuel = null;

onAuthStateChanged(auth, async function(utilisateur) {
  utilisateurActuel = utilisateur;

  await afficherCompte(utilisateur);
  demarrerEcoutePanierHeader(utilisateur);

  if (utilisateur) {
    initialiserEasterEgg(utilisateur);

    const userData = await obtenirUtilisateurFirestore(utilisateur.uid);

    if (userData?.banJusqua) {
      const maintenant = Date.now();
      const timestampBan = typeof userData.banJusqua === 'number'
        ? userData.banJusqua
        : userData.banJusqua.toMillis ? userData.banJusqua.toMillis() : 0;

      if (timestampBan > maintenant) {
        const dateFin = new Date(timestampBan).toLocaleString();
        alert(`Votre compte est banni jusqu'au ${dateFin}.`);
        await signOut(auth);
        window.location.href = 'portail-compte.html';
      }
    }
  }
});


// =========================================================
// PANIER
// =========================================================

function creerModalePanier() {
  if (document.getElementById('modale-panier-connexion')) return;

  const overlay = document.createElement('div');
  overlay.id = 'modale-panier-connexion';
  overlay.className = 'panier-connexion-overlay hidden';

  overlay.innerHTML = `
    <div class="panier-connexion-modale" role="dialog" aria-modal="true">
      <p class="panier-connexion-titre">Connecte-toi pour continuer</p>
      <p class="panier-connexion-texte">
        Tu dois être connecté à ton compte pour ajouter un article au panier.
      </p>
      <div class="panier-connexion-actions">
        <button type="button" class="btn btn-secondary" id="panier-annuler">Annuler</button>
        <a href="portail-compte.html" class="btn btn-primary">Se connecter</a>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  function fermerModale() {
    overlay.classList.add('hidden');
  }

  overlay.addEventListener('click', function(event) {
    if (event.target === overlay) fermerModale();
  });

  document.getElementById('panier-annuler').addEventListener('click', fermerModale);
}

function ouvrirModalePanier() {
  creerModalePanier();
  document.getElementById('modale-panier-connexion').classList.remove('hidden');
}

export async function obtenirPanier(uid) {
  try {
    const instantane = await getDoc(doc(db, 'paniers', uid));
    return instantane.exists() ? (instantane.data().articles || []) : [];
  } catch (erreur) {
    console.error('Impossible de lire le panier :', erreur);
    return [];
  }
}

export function ecouterPanier(uid, callback) {
  return onSnapshot(
    doc(db, 'paniers', uid),
    function(instantane) {
      const articles = instantane.exists() ? (instantane.data().articles || []) : [];
      callback(articles);
    },
    function(erreur) {
      console.error('Impossible de suivre le panier en direct :', erreur);
    }
  );
}

export async function ajouterAuPanier(uid, produit) {
  const articlesActuels = await obtenirPanier(uid);
  const index = articlesActuels.findIndex(item => item.id === produit.id);
  let nouveauxArticles;

  if (index === -1) {
    nouveauxArticles = articlesActuels.concat([produit]);
  } else {
    nouveauxArticles = articlesActuels.slice();
    nouveauxArticles[index] = {
      ...nouveauxArticles[index],
      quantite: (nouveauxArticles[index].quantite || 1) + (produit.quantite || 1)
    };
  }

  await setDoc(doc(db, 'paniers', uid), { articles: nouveauxArticles });
}

export async function modifierQuantitePanier(uid, idArticle, quantite) {
  const articlesActuels = await obtenirPanier(uid);
  const quantiteValide = Math.max(1, Math.min(99, Math.round(quantite) || 1));

  const nouveauxArticles = articlesActuels.map(function(item) {
    if (item.id === idArticle) {
      return { ...item, quantite: quantiteValide };
    }
    return item;
  });

  await setDoc(doc(db, 'paniers', uid), { articles: nouveauxArticles });
}

export async function retirerDuPanier(uid, idArticle) {
  const articlesActuels = await obtenirPanier(uid);
  const nouveauxArticles = articlesActuels.filter(item => item.id !== idArticle);
  await setDoc(doc(db, 'paniers', uid), { articles: nouveauxArticles });
}

function extraireInfosProduit(bouton) {
  const carte = bouton.closest('.product-card');

  if (carte) {
    const image = carte.querySelector('.product-image img');
    const nom = carte.querySelector('.product-name').textContent.trim();
    const prix = carte.querySelector('.product-price').innerHTML;
    const lienDecouvrir = carte.querySelector('a.btn-secondary');
    const champQuantite = carte.querySelector('.quantite-champ');

    return {
      id: lienDecouvrir.getAttribute('href'),
      nom,
      prix,
      image: image.getAttribute('src'),
      imageAlt: image.getAttribute('alt') || '',
      lien: lienDecouvrir.getAttribute('href'),
      quantite: lireQuantiteChamp(champQuantite)
    };
  }

  const hero = bouton.closest('.hero');

  if (hero) {
    const image = document.getElementById('gallery-img') || hero.querySelector('.hero-image-frame img');
    const nom = hero.querySelector('.hero-copy h1').textContent.trim();
    const prix = hero.querySelector('.product-price').innerHTML;
    const champQuantite = hero.querySelector('.quantite-champ');
    const lien = window.location.pathname.split('/').pop();

    return {
      id: lien,
      nom,
      prix,
      image: image.getAttribute('src'),
      imageAlt: image.getAttribute('alt') || '',
      lien,
      quantite: lireQuantiteChamp(champQuantite)
    };
  }

  return null;
}

function lireQuantiteChamp(champ) {
  if (!champ) return 1;
  const valeur = parseInt(champ.value, 10);
  return isNaN(valeur) || valeur < 1 ? 1 : Math.min(99, valeur);
}

document.addEventListener('click', function(event) {
  const boutonMoins = event.target.closest('[data-quantite-moins]');
  const boutonPlus = event.target.closest('[data-quantite-plus]');

  if (!boutonMoins && !boutonPlus) return;

  const selecteur = (boutonMoins || boutonPlus).closest('.quantite-selecteur');
  if (!selecteur || selecteur.dataset.produitId) return;

  const champ = selecteur.querySelector('.quantite-champ');
  const valeurActuelle = parseInt(champ.value, 10) || 1;

  champ.value = boutonMoins
    ? Math.max(1, valeurActuelle - 1)
    : Math.min(99, valeurActuelle + 1);
});

document.addEventListener('change', function(event) {
  const champ = event.target.closest('.quantite-champ');
  if (!champ) return;

  const selecteur = champ.closest('.quantite-selecteur');
  if (selecteur && selecteur.dataset.produitId) return;

  champ.value = lireQuantiteChamp(champ);
});

export function creerApercuArticlePanier(produit, options) {
  options = options || {};
  const idEchappe = echapperHTML(produit.id);

  return `
    <article class="product-card">
      <div class="product-image">
        <img src="${produit.image}" alt="${echapperHTML(produit.imageAlt)}">
      </div>
      <div class="product-info">
        <h3 class="product-name">${echapperHTML(produit.nom)}</h3>
        <p class="product-price">${produit.prix}</p>
        ${
          options.avecBoutonRetirer
            ? `
              <div class="quantite-selecteur" data-produit-id="${idEchappe}">
                <button type="button" class="quantite-bouton" data-quantite-moins aria-label="Diminuer la quantité">−</button>
                <input type="number" class="quantite-champ" value="${produit.quantite || 1}" min="1" max="99" aria-label="Quantité">
                <button type="button" class="quantite-bouton" data-quantite-plus aria-label="Augmenter la quantité">+</button>
              </div>
            `
            : ''
        }
        <a href="${produit.lien}" class="btn btn-secondary">Découvrir</a>
        ${
          options.avecBoutonRetirer
            ? `<button type="button" class="btn btn-secondary" data-retirer="${idEchappe}">Retirer</button>`
            : ''
        }
      </div>
    </article>
  `;
}

let desabonnerPanierHeader = null;

function demarrerEcoutePanierHeader(utilisateur) {
  if (desabonnerPanierHeader) {
    desabonnerPanierHeader();
    desabonnerPanierHeader = null;
  }

  if (!utilisateur) {
    mettreAJourCompteurPanier([]);
    return;
  }

  desabonnerPanierHeader = ecouterPanier(utilisateur.uid, mettreAJourCompteurPanier);
}

function mettreAJourCompteurPanier(articles) {
  const compteur = document.getElementById('cart-count');
  if (compteur) {
    const total = articles.reduce(function(somme, article) {
      return somme + (article.quantite || 1);
    }, 0);
    compteur.textContent = total;
  }
}

document.addEventListener('click', function(event) {
  const bouton = event.target.closest('.add-to-cart');
  if (!bouton) return;

  if (!utilisateurActuel) {
    event.preventDefault();
    ouvrirModalePanier();
    return;
  }

  const infosProduit = extraireInfosProduit(bouton);
  if (!infosProduit) return;

  ajouterAuPanier(utilisateurActuel.uid, infosProduit)
    .then(function() {
      const contexte = bouton.closest('.product-card') || bouton.closest('.hero');
      const champQuantite = contexte && contexte.querySelector('.quantite-champ');
      if (champQuantite) champQuantite.value = 1;
    })
    .catch(function(erreur) {
      console.error("Impossible d'ajouter l'article au panier :", erreur);
    });
});


// =========================================================
// PROTECTION DES PAGES SELON LE RÔLE
// =========================================================

export function protegerPage(rolesAutorises = []) {
  onAuthStateChanged(auth, async function(utilisateur) {
    if (!utilisateur) {
      window.location.href = 'portail-compte.html';
      return;
    }

    const userData = await obtenirUtilisateurFirestore(utilisateur.uid);

    if (userData?.banJusqua) {
      const maintenant = Date.now();
      const timestampBan = typeof userData.banJusqua === 'number'
        ? userData.banJusqua
        : userData.banJusqua.toMillis ? userData.banJusqua.toMillis() : 0;

      if (timestampBan > maintenant) {
        const dateFin = new Date(timestampBan).toLocaleString();
        alert(`Votre compte est banni jusqu'au ${dateFin}.`);
        await signOut(auth);
        window.location.href = 'portail-compte.html';
        return;
      }
    }

    const roleActuel = userData?.role || 'membre';

    if (rolesAutorises.length > 0 && !rolesAutorises.includes(roleActuel)) {
      switch (roleActuel) {
        case 'admin':
          window.location.href = 'admin-status.html';
          break;
        case 'vip_payant':
          window.location.href = 'vip.html';
          break;
        case 'vip_gratuit':
          window.location.href = 'free-vip.html';
          break;
        default:
          window.location.href = 'membre.html';
          break;
      }
    }
  });
}


// =========================================================
// GESTION DES COMPTES (ADMIN)
// =========================================================

export function ecouterComptes(callback) {
  return onSnapshot(
    collection(db, 'utilisateurs'),
    function(instantane) {
      const comptes = instantane.docs.map(function(document) {
        return { id: document.id, ...document.data() };
      });
      callback(comptes);
    },
    function(erreur) {
      console.error("Impossible d'écouter les comptes :", erreur);
    }
  );
}

export async function modifierRoleUtilisateur(uid, nouveauRole) {
  await updateDoc(doc(db, 'utilisateurs', uid), {
    role: nouveauRole
  });
}

export async function bannirUtilisateur(uid, duree) {
  const maintenant = Date.now();
  let banJusqua = 0;

  if (duree === '1_semaine') {
    banJusqua = maintenant + (7 * 24 * 60 * 60 * 1000);
  } else if (duree === '1_mois') {
    banJusqua = maintenant + (30 * 24 * 60 * 60 * 1000);
  } else if (duree === 'permanent') {
    banJusqua = 32503680000000;
  }

  await updateDoc(doc(db, 'utilisateurs', uid), {
    banJusqua: banJusqua
  });
}

export async function debannirUtilisateur(uid) {
  await updateDoc(doc(db, 'utilisateurs', uid), {
    banJusqua: 0
  });
}

export async function convertirFichierEnBase64(fichier) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.readAsDataURL(fichier);
    lecteur.onload = () => resolve(lecteur.result);
    lecteur.onerror = (erreur) => reject(erreur);
  });
}

export function formaterPrixCommande(prixMatiere, avecFichier = false) {
  const base = Number(prixMatiere) || 0;
  const taxes = avecFichier ? 0.20 : 0.40;
  const total = base + taxes;

  function euros(nombre) {
    return nombre.toFixed(2).replace('.', ',') + ' €';
  }

  return (
    `<strong>${euros(total)}</strong> ` +
    `<span class="price-detail">(${euros(base)} + taxes (${taxes.toFixed(2).replace('.', ',')}€))</span>`
  );
}