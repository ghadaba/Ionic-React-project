import type { Movie } from "./catalog";

// Informations d'un profil nécessaires au calcul de compatibilité.
// Les champs email, mot de passe, etc. ne sont pas requis par cet algorithme.
export interface MatchProfile {
  uid: string;
  firstName: string;
  lastName: string;
  age: number;
  photoURL: string;
  favoriteMovieIds: string[];
  active: boolean;
}

// Indice de similarité de Jaccard entre deux ensembles :
// taille des éléments communs / taille de l'ensemble de tous les éléments.
function jaccard<T>(left: Set<T>, right: Set<T>): number {
  // Deux ensembles vides n'ont aucune ressemblance exploitable : on renvoie 0
  // plutôt que de diviser par zéro.
  if (left.size === 0 && right.size === 0) return 0;

  let intersection = 0;
  // On compte les éléments présents dans les deux ensembles.
  for (const value of left) if (right.has(value)) intersection += 1;
  // |A union B| = |A| + |B| - |A intersection B|.
  return intersection / (left.size + right.size - intersection);
}

// Mesure si les films favoris des deux personnes sont proches en époque.
function yearSimilarity(left: Movie[], right: Movie[]): number {
  // Sans film d'un côté, aucune comparaison d'années n'est possible.
  if (left.length === 0 || right.length === 0) return 0;

  // Pour chaque film source, cherche le film cible dont l'année est la plus
  // proche. Un écart de 0 vaut 1; à partir de 25 ans, la similarité vaut 0.
  const closestAverage = (source: Movie[], target: Movie[]) =>
    source.reduce((sum, movie) => {
      const gap = Math.min(...target.map((other) => Math.abs(movie.year - other.year)));
      return sum + Math.max(0, 1 - gap / 25);
    }, 0) / source.length;

  // On fait la moyenne dans les deux directions pour traiter les listes
  // équitablement même si elles n'ont pas le même nombre de films.
  return (closestAverage(left, right) + closestAverage(right, left)) / 2;
}

// Calcule un score de compatibilité compris entre 0 et 100.
//  films identiques (40 %), genres (30 %), acteurs (20 %) et proximité des années (10 %)
export function calculateMatchScore(
  first: MatchProfile,
  second: MatchProfile,
  movies: Movie[],
): number {
  // Indexe le catalogue pour retrouver rapidement un film à partir de son ID.
  const byId = new Map(movies.map((movie) => [movie.id, movie]));

  // Résout les IDs favoris en films; les IDs absents du catalogue sont ignorés.
  const firstMovies = first.favoriteMovieIds
    .map((id) => byId.get(id))
    .filter((movie): movie is Movie => movie !== undefined);
  const secondMovies = second.favoriteMovieIds
    .map((id) => byId.get(id))
    .filter((movie): movie is Movie => movie !== undefined);

  // Le score reste nul si l'un des profils n'a aucun favori valide à comparer.
  if (firstMovies.length === 0 || secondMovies.length === 0) return 0;

  // Prépare des ensembles de genres, acteurs et identifiants sans doublons :
  // chaque catégorie sera comparée avec la similarité de Jaccard.
  const genres = (favorites: Movie[]) => new Set(favorites.flatMap((movie) => movie.genres));
  const actors = (favorites: Movie[]) => new Set(favorites.flatMap((movie) => movie.actors));
  const movieIds = (favorites: Movie[]) => new Set(favorites.map((movie) => movie.id));

  // Combine quatre signaux avec des poids totalisant 1 (100 %) :
  // films communs 40 %, genres 30 %, acteurs 20 %, années 10 %.
  const score =
    jaccard(movieIds(firstMovies), movieIds(secondMovies)) * 0.4 +
    jaccard(genres(firstMovies), genres(secondMovies)) * 0.3 +
    jaccard(actors(firstMovies), actors(secondMovies)) * 0.2 +
    yearSimilarity(firstMovies, secondMovies) * 0.1;

  // Les composantes sont entre 0 et 1; la multiplication convertit le résultat
  // en pourcentage pour l'affichage et le filtrage par l'appelant.
  return score * 100;
}
