import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  IonApp,
  IonAvatar,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonLabel,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonToast,
  IonToolbar,
} from "@ionic/react";
import {
  add,
  cameraOutline,
  heart,
  heartOutline,
  logOutOutline,
  peopleOutline,
  personCircleOutline,
  filmOutline,
} from "ionicons/icons";
import type { Movie } from "./catalog";
import {
  clearSession,
  createPasswordHash,
  loadAccounts,
  loadMovies,
  loadSessionUid,
  saveAccounts,
  saveMovies,
  saveSessionUid,
  verifyPassword,
  type LocalAccount,
  type Profile,
} from "./localStore";
import { takeProfilePhoto, readProfilePhoto } from "./profilePhoto";
import { calculateMatchScore } from "./matching";
import { loadMovieCatalog } from "./tmdb";

type Section = "catalogue" | "favoris" | "rencontres" | "admin";

function App() {
  const [accounts, setAccounts] = useState<LocalAccount[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [catalogNotice, setCatalogNotice] = useState("");
  const [section, setSection] = useState<Section>("catalogue");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [registering, setRegistering] = useState(false);
  const [photo, setPhoto] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function restoreLocalData() {
      try {
        let [savedAccounts, savedMovies, sessionUid, catalog] = await Promise.all([
          loadAccounts(),
          loadMovies(),
          loadSessionUid(),
          loadMovieCatalog(),
        ]);
        if (savedAccounts.length > 0 && !savedAccounts.some(({ profile: saved }) => saved.isAdmin)) {
          savedAccounts = savedAccounts.map((account, index) => index === 0
            ? { ...account, profile: { ...account.profile, isAdmin: true } }
            : account);
          await saveAccounts(savedAccounts);
        }
        if (cancelled) return;
        setAccounts(savedAccounts);
        setCatalogNotice(catalog.notice);
        setMovies([...catalog.movies, ...savedMovies.filter(
          (movie) => !catalog.movies.some((item) => item.id === movie.id),
        )]);
        const currentAccount = savedAccounts.find(({ profile: saved }) => saved.uid === sessionUid);
        if (currentAccount && !currentAccount.profile.active) {
          await clearSession();
          setProfile(null);
          setError("Ce compte a été désactivé par l’administrateur. Contactez-le pour le réactiver.");
        } else {
          setProfile(currentAccount?.profile ?? null);
        }
        if (sessionUid && !currentAccount) await clearSession();
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error
            ? `Impossible de lire les données locales : ${loadError.message}`
            : "Impossible de lire les données locales.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void restoreLocalData();
    return () => { cancelled = true; };
  }, []);

  const profiles = useMemo(
    () => accounts
      .map((account) => account.profile)
      .filter((other) => other.uid !== profile?.uid && other.active),
    [accounts, profile],
  );
  const favoriteMovies = useMemo(
    () => movies.filter((movie) => profile?.favoriteMovieIds.includes(movie.id)),
    [movies, profile],
  );
  // Construit la liste des rencontres à partir des profils actifs déjà filtrés
  // (sans le profil connecté). useMemo recalcule les scores seulement si les
  // films, le profil courant ou la liste des profils change.
  const matches = useMemo(
    () => profiles
      .map((other) => ({
        profile: other,
        // Le score compare les favoris du profil courant à ceux du profil évalué.
        score: profile ? calculateMatchScore(profile, other, movies) : 0,
      }))
      // L'application présente uniquement les compatibilités strictement > 75.
      .filter((match) => match.score > 75)
      // Les meilleures compatibilités apparaissent en premier.
      .sort((left, right) => right.score - left.score),
    [movies, profile, profiles],
  );

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim().toLowerCase();
    const password = String(form.get("password"));
    setBusy(true);
    setError("");
    try {
      const account = accounts.find(({ profile: saved }) => saved.email.toLowerCase() === email);
      if (!account) {
        setError("Aucun compte local n’utilise cette adresse e-mail. Inscrivez-vous d’abord sur cet appareil.");
        return;
      }
      if (!(await verifyPassword(password, account.passwordSalt, account.passwordHash))) {
        setError("Mot de passe incorrect. Vérifiez-le et réessayez.");
        return;
      }
      if (!account.profile.active) {
        setError("Ce compte a été désactivé par l’administrateur. Contactez-le pour le réactiver.");
        return;
      }
      await saveSessionUid(account.profile.uid);
      setProfile(account.profile);
      setPhoto("");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "La connexion locale a échoué.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get("firstName")).trim();
    const lastName = String(form.get("lastName")).trim();
    const age = Number(form.get("age"));
    const email = String(form.get("email")).trim().toLowerCase();
    const password = String(form.get("password"));
    if (!photo) {
      setError("Prenez une photo ou choisissez une image avant de créer le compte.");
      return;
    }
    if (accounts.some(({ profile: saved }) => saved.email.toLowerCase() === email)) {
      setError("Un compte local utilise déjà cette adresse e-mail.");
      return;
    }
    if (!Number.isInteger(age) || age < 1 || age > 120) {
      setError("Saisissez un âge valide.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { salt, hash } = await createPasswordHash(password);
      const newProfile: Profile = {
        uid: crypto.randomUUID(),
        firstName,
        lastName,
        age,
        photoURL: photo,
        favoriteMovieIds: [],
        active: true,
        email,
        createdAt: Date.now(),
        isAdmin: accounts.length === 0,
      };
      const nextAccounts = [...accounts, {
        profile: newProfile,
        passwordSalt: salt,
        passwordHash: hash,
      }];
      await saveAccounts(nextAccounts);
      await saveSessionUid(newProfile.uid);
      setAccounts(nextAccounts);
      setProfile(newProfile);
      setPhoto("");
      setRegistering(false);
      setToast("Votre compte local est prêt. Bienvenue !");
    } catch (registrationError) {
      setError(registrationError instanceof Error
        ? `Le compte n’a pas pu être enregistré : ${registrationError.message}`
        : "Le compte local n’a pas pu être enregistré.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleFavorite(movieId: string) {
    if (!profile) return;
    const isFavorite = profile.favoriteMovieIds.includes(movieId);
    const updatedProfile = {
      ...profile,
      favoriteMovieIds: isFavorite
        ? profile.favoriteMovieIds.filter((id) => id !== movieId)
        : [...profile.favoriteMovieIds, movieId],
    };
    const nextAccounts = accounts.map((account) => account.profile.uid === profile.uid
      ? { ...account, profile: updatedProfile }
      : account);
    try {
      await saveAccounts(nextAccounts);
      setAccounts(nextAccounts);
      setProfile(updatedProfile);
    } catch (saveError) {
      setError(saveError instanceof Error
        ? `Impossible d’enregistrer vos favoris : ${saveError.message}`
        : "Impossible d’enregistrer vos favoris.");
    }
  }

  async function handleAddMovie(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile?.isAdmin) {
      setError("Seul l’administrateur peut ajouter des films.");
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title")).trim();
    const year = Number(form.get("year"));
    const genres = String(form.get("genres")).split(",").map((item) => item.trim()).filter(Boolean);
    const actors = String(form.get("actors")).split(",").map((item) => item.trim()).filter(Boolean);
    if (!title || !Number.isInteger(year) || genres.length === 0 || actors.length === 0) {
      setError("Complétez le titre, l’année, au moins un genre et un acteur.");
      return;
    }
    const movie: Movie = {
      id: crypto.randomUUID(),
      title,
      year,
      genres,
      actors,
      posterUrl: String(form.get("posterUrl")).trim(),
      overview: String(form.get("overview")).trim(),
    };
    const nextMovies = [...movies, movie];
    try {
      await saveMovies(nextMovies.filter(
        (item) => !item.id.startsWith("tmdb-"),
      ));
      setMovies(nextMovies);
      formElement.reset();
      setToast("Film ajouté au catalogue local.");
    } catch (saveError) {
      setError(saveError instanceof Error
        ? `Impossible d’enregistrer le film : ${saveError.message}`
        : "Impossible d’enregistrer le film.");
    }
  }

  async function toggleUserActive(target: Profile) {
    if (!profile?.isAdmin || target.uid === profile.uid) {
      setError("Seul l’administrateur peut modifier l’état des autres comptes.");
      return;
    }
    const updatedProfile = { ...target, active: !target.active };
    const nextAccounts = accounts.map((account) => account.profile.uid === target.uid
      ? { ...account, profile: updatedProfile }
      : account);
    try {
      await saveAccounts(nextAccounts);
      setAccounts(nextAccounts);
      setToast(updatedProfile.active
        ? `Le compte de ${target.firstName} a été réactivé.`
        : `Le compte de ${target.firstName} a été désactivé sans être supprimé.`);
    } catch (saveError) {
      setError(saveError instanceof Error
        ? `Impossible de modifier ce compte : ${saveError.message}`
        : "Impossible de modifier ce compte.");
    }
  }

  async function handleLogout() {
    try {
      await clearSession();
      setProfile(null);
      setPhoto("");
      setSection("catalogue");
    } catch (logoutError) {
      setError(logoutError instanceof Error
        ? `Impossible de fermer la session : ${logoutError.message}`
        : "Impossible de fermer la session locale.");
    }
  }

  if (loading) {
    return <IonApp><IonPage><IonContent className="ion-padding setup-screen">
      <div className="loading-state"><IonSpinner /><p>Chargement de CinéMatch…</p></div>
    </IonContent></IonPage></IonApp>;
  }

  if (!profile) {
    return (
      <IonApp>
        <IonPage>
          <IonContent className="ion-padding auth-screen">
            <div className="auth-layout">
              <section className="auth-intro">
                <span className="brand-mark">C</span>
                <p className="eyebrow">LE CINÉMA SE PARTAGE</p>
                <h1>Vos films préférés.<br />Vos prochains amis.</h1>
                <p>Découvrez des passionnés qui aiment les mêmes histoires que vous.</p>
                <div className="intro-tags"><span>✦ Cinéma</span><span>✦ Rencontres</span><span>✦ Sur cet appareil</span></div>
              </section>
              <section className="auth-card">
                <div className="auth-switch">
                  <button className={!registering ? "selected" : ""} onClick={() => { setRegistering(false); setError(""); setPhoto(""); }}>Connexion</button>
                  <button className={registering ? "selected" : ""} onClick={() => { setRegistering(true); setError(""); setPhoto(""); }}>Inscription</button>
                </div>
                <h2>{registering ? "Créer mon compte local" : "Ravi de vous revoir"}</h2>
                <p className="muted">{registering ? "Votre profil restera enregistré sur cet appareil." : "Connectez-vous au compte enregistré sur cet appareil."}</p>
                <form onSubmit={registering ? handleRegister : handleLogin} className="auth-form">
                  {registering && <>
                    <IonInput label="Prénom" labelPlacement="stacked" name="firstName" required autocomplete="given-name" />
                    <IonInput label="Nom" labelPlacement="stacked" name="lastName" required autocomplete="family-name" />
                    <IonInput label="Âge" labelPlacement="stacked" name="age" type="number" min="1" max="120" required />
                  </>}
                  <IonInput label="Adresse e-mail" labelPlacement="stacked" name="email" type="email" required autocomplete="email" />
                  <IonInput label="Mot de passe" labelPlacement="stacked" name="password" type="password" required minlength={6} autocomplete={registering ? "new-password" : "current-password"} />
                  {registering && <ProfilePhotoPicker photo={photo} onPhoto={setPhoto} onError={setError} />}
                  {error && <p className="error-message" role="alert">{error}</p>}
                  <IonButton expand="block" type="submit" disabled={busy}>
                    {busy ? <IonSpinner name="crescent" /> : registering ? "Créer mon compte" : "Me connecter"}
                  </IonButton>
                </form>
                <p className="muted legal-note">Les comptes, photos et favoris ne sont pas synchronisés avec d’autres appareils.</p>
              </section>
            </div>
          </IonContent>
        </IonPage>
      </IonApp>
    );
  }

  return (
    <IonApp>
      <IonPage>
        <IonHeader className="app-header">
          <IonToolbar>
            <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setSection("catalogue"); }}>
              <span className="brand-mark small">C</span><span>Ciné<span>Match</span></span>
            </a>
            <div className="header-account">
              <span className="account-name">{profile.firstName}</span>
              <IonAvatar><img src={profile.photoURL} alt={`Photo de ${profile.firstName}`} /></IonAvatar>
              <IonButton fill="clear" aria-label="Se déconnecter" onClick={handleLogout}><IonIcon icon={logOutOutline} /></IonButton>
            </div>
          </IonToolbar>
        </IonHeader>
        <IonContent className="main-content">
          <div className="page-shell">
            <section className="welcome-banner">
              <div><p className="eyebrow">VOTRE ESPACE CINÉ</p><h1>Bonjour {profile.firstName} <span>✦</span></h1>
                <p>Les bonnes histoires sont encore meilleures quand elles sont partagées.</p></div>
              <div className="banner-stats"><div><strong>{favoriteMovies.length}</strong><span>favoris</span></div><div><strong>{matches.length}</strong><span>affinités</span></div></div>
            </section>
            {catalogNotice && section === "catalogue" && <p className="catalog-notice" role="status">{catalogNotice}</p>}
            <IonSegment value={section} onIonChange={(event) => {
              const value = event.detail.value;
              if (value === "catalogue" || value === "favoris" || value === "rencontres" || value === "admin") setSection(value);
            }} scrollable>
              <IonSegmentButton value="catalogue"><IonIcon icon={filmOutline} /><IonLabel>Catalogue</IonLabel></IonSegmentButton>
              <IonSegmentButton value="favoris"><IonIcon icon={heartOutline} /><IonLabel>Ma playlist</IonLabel></IonSegmentButton>
              <IonSegmentButton value="rencontres"><IonIcon icon={peopleOutline} /><IonLabel>Mes matchs</IonLabel></IonSegmentButton>
              {profile.isAdmin && <IonSegmentButton value="admin"><IonIcon icon={add} /><IonLabel>Administration</IonLabel></IonSegmentButton>}
            </IonSegment>

            {section === "catalogue" && <MovieGrid movies={movies} favorites={profile.favoriteMovieIds} onToggle={toggleFavorite} title="À l'affiche chez vous" subtitle="Des films à découvrir, et peut-être de nouvelles affinités." />}
            {section === "favoris" && <MovieGrid movies={favoriteMovies} favorites={profile.favoriteMovieIds} onToggle={toggleFavorite} title="Votre playlist" subtitle={`${favoriteMovies.length} film${favoriteMovies.length === 1 ? "" : "s"} gardé${favoriteMovies.length === 1 ? "" : "s"} pour vous. Ajoutez-en pour affiner vos matchs.`} empty="Votre playlist est encore vide. Parcourez le catalogue et ajoutez vos coups de cœur." />}
            {section === "rencontres" && <section className="section-block"><div className="section-heading"><div><p className="eyebrow">LES GOÛTS EN COMMUN</p><h2>Vos affinités cinéma</h2><p className="muted">Les matchs sont calculés parmi les comptes locaux de cet appareil.</p></div><span className="match-count">{matches.length} match{matches.length === 1 ? "" : "s"}</span></div>
              {profile.favoriteMovieIds.length === 0 ? <EmptyState text="Ajoutez des films à votre playlist pour découvrir vos affinités." /> : matches.length === 0 ? <EmptyState text="Pas encore de match à plus de 75 %. Créez un autre compte local sur cet appareil et ajoutez des favoris." /> : <div className="match-grid">{matches.map(({ profile: other, score }) => <IonCard className="match-card" key={other.uid}><IonCardContent><IonAvatar className="match-avatar"><img src={other.photoURL} alt={`Photo de ${other.firstName}`} /></IonAvatar><div className="match-info"><h3>{other.firstName}, {other.age} ans</h3><p>{other.favoriteMovieIds.length} films en favoris</p></div><div className="match-score">{score.toFixed(1)}%</div></IonCardContent></IonCard>)}</div>}
            </section>}
            {section === "admin" && profile.isAdmin && <AdminPanel movies={movies} profiles={accounts.map((account) => account.profile)} currentUid={profile.uid} onAddMovie={handleAddMovie} onToggleUser={toggleUserActive} />}
            <footer className="site-footer">
              CinéMatch <span>•</span> Données stockées sur cet appareil
              <span>•</span> This product uses the TMDB API but is not endorsed or certified by TMDB.
            </footer>
          </div>
        </IonContent>
        <IonToast isOpen={Boolean(toast)} message={toast} duration={2400} onDidDismiss={() => setToast("")} />
        <IonToast isOpen={Boolean(error) && Boolean(profile)} message={error} duration={4000} color="danger" onDidDismiss={() => setError("")} />
      </IonPage>
    </IonApp>
  );
}

function ProfilePhotoPicker({ photo, onPhoto, onError }: {
  photo: string;
  onPhoto: (photo: string) => void;
  onError: (message: string) => void;
}) {
  const [cameraBusy, setCameraBusy] = useState(false);
  async function takePhoto() {
    setCameraBusy(true);
    onError("");
    try {
      onPhoto(await takeProfilePhoto());
    } catch (cameraError) {
      onError(cameraError instanceof Error
        ? `La caméra n’a pas pu fournir de photo : ${cameraError.message} Vous pouvez aussi choisir un fichier ci-dessous.`
        : "La caméra n’a pas pu fournir de photo. Choisissez un fichier ci-dessous.");
    } finally {
      setCameraBusy(false);
    }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    onError("");
    try {
      onPhoto(await readProfilePhoto(file));
    } catch (photoError) {
      onError(photoError instanceof Error ? photoError.message : "La photo sélectionnée n’a pas pu être lue.");
    }
  }

  return (
    <div className="file-field">
      <span>Photo de profil</span>
      {photo && <IonAvatar className="photo-preview"><img src={photo} alt="Aperçu de la photo de profil" /></IonAvatar>}
      <IonButton type="button" fill="outline" expand="block" onClick={takePhoto} disabled={cameraBusy}>
        {cameraBusy ? <IonSpinner name="crescent" /> : <><IonIcon icon={cameraOutline} slot="start" />Prendre une photo</>}
      </IonButton>
      <label className="photo-file-label">Ou choisir une image
        <input type="file" accept="image/*" capture="user" onChange={(event) => void chooseFile(event)} />
      </label>
      <span className="muted">Sur le Web, la caméra nécessite l’autorisation du navigateur et une connexion sécurisée (HTTPS ou localhost).</span>
    </div>
  );
}

function MovieGrid({ movies, favorites, onToggle, title, subtitle, empty }: {
  movies: Movie[];
  favorites: string[];
  onToggle: (id: string) => void;
  title: string;
  subtitle: string;
  empty?: string;
}) {
  return <section className="section-block"><div className="section-heading"><div><p className="eyebrow">SÉLECTION CINÉMATCH</p><h2>{title}</h2><p className="muted">{subtitle}</p></div><span className="movie-count">{movies.length} films</span></div>
    {movies.length === 0 ? <EmptyState text={empty ?? "Aucun film disponible pour le moment."} /> : <div className="movie-grid">{movies.map((movie) => {
      const isFavorite = favorites.includes(movie.id);
      return <IonCard className="movie-card" key={movie.id}><div className="poster-wrap">
        {movie.posterUrl ? <img className="poster" src={movie.posterUrl} alt={`Affiche du film ${movie.title}`} loading="lazy" /> : <div className="poster-placeholder"><IonIcon icon={filmOutline} /><span>{movie.title}</span></div>}
        <button className={`favorite-button ${isFavorite ? "is-favorite" : ""}`} onClick={() => onToggle(movie.id)} aria-label={isFavorite ? `Retirer ${movie.title} des favoris` : `Ajouter ${movie.title} aux favoris`}><IonIcon icon={isFavorite ? heart : heartOutline} /></button>
      </div><IonCardHeader><IonCardSubtitle>{movie.year} <span>•</span> {movie.genres.slice(0, 2).join(" / ")}</IonCardSubtitle><IonCardTitle>{movie.title}</IonCardTitle></IonCardHeader><IonCardContent><p className="movie-overview">{movie.overview}</p><p className="movie-cast">{movie.actors.slice(0, 3).join(" · ")}</p></IonCardContent></IonCard>;
    })}</div>}
  </section>;
}

function AddMovieForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <section className="section-block"><div className="section-heading"><div><p className="eyebrow">CATALOGUE LOCAL</p><h2>Ajouter un film</h2><p className="muted">Ce film sera enregistré uniquement sur cet appareil.</p></div></div>
    <IonCard className="admin-card"><IonCardContent><form className="admin-form" onSubmit={onSubmit}>
      <IonInput label="Titre" labelPlacement="stacked" name="title" required />
      <IonInput label="Année de sortie" labelPlacement="stacked" name="year" type="number" min="1888" max="2100" required />
      <IonInput label="Genres (séparés par des virgules)" labelPlacement="stacked" name="genres" placeholder="Drame, Thriller" required />
      <IonInput label="Acteurs (séparés par des virgules)" labelPlacement="stacked" name="actors" placeholder="Nom, Nom" required />
      <IonInput label="URL de l'affiche (facultatif)" labelPlacement="stacked" name="posterUrl" type="url" />
      <IonInput label="Résumé" labelPlacement="stacked" name="overview" />
      <IonButton type="submit"><IonIcon icon={add} slot="start" />Ajouter au catalogue</IonButton>
    </form></IonCardContent></IonCard>
  </section>;
}

function AdminPanel({ movies, profiles, currentUid, onAddMovie, onToggleUser }: {
  movies: Movie[];
  profiles: Profile[];
  currentUid: string;
  onAddMovie: (event: FormEvent<HTMLFormElement>) => void;
  onToggleUser: (profile: Profile) => void;
}) {
  const members = profiles.filter((member) => member.uid !== currentUid);
  return <section className="section-block">
    <div className="section-heading"><div><p className="eyebrow">ESPACE ADMINISTRATEUR LOCAL</p><h2>Administration</h2><p className="muted">Ajoutez des films et désactivez ou réactivez un compte sans effacer ses données.</p></div></div>
    <div className="admin-grid">
      <AddMovieForm onSubmit={onAddMovie} />
      <IonCard className="admin-card"><IonCardHeader><IonCardTitle><IonIcon icon={peopleOutline} /> Membres</IonCardTitle><IonCardSubtitle>{members.length} autre{members.length === 1 ? "" : "s"} compte{members.length === 1 ? "" : "s"} local</IonCardSubtitle></IonCardHeader><IonCardContent>
        {members.length === 0 ? <p className="muted">Aucun autre compte sur cet appareil.</p> : <div className="member-list">{members.map((member) => <div className="member-row" key={member.uid}>
          <IonAvatar><img src={member.photoURL} alt="" /></IonAvatar>
          <div><strong>{member.firstName} {member.lastName}</strong><span>{member.email} · {member.active ? "Actif" : "Désactivé"}{member.isAdmin ? " · Administrateur" : ""}</span></div>
          <IonButton size="small" fill="outline" color={member.active ? "danger" : "success"} onClick={() => onToggleUser(member)}>{member.active ? "Désactiver" : "Réactiver"}</IonButton>
        </div>)}</div>}
      </IonCardContent></IonCard>
    </div>
    <p className="admin-footnote">{movies.length} films dans le catalogue. Le premier compte local créé est administrateur. Les rôles restent sur cet appareil et ne constituent pas une sécurité serveur.</p>
  </section>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><IonIcon icon={personCircleOutline} /><p>{text}</p></div>;
}

export default App;
