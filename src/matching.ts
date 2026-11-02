import type { Movie } from "./catalog";

export interface MatchProfile {
  uid: string;
  firstName: string;
  lastName: string;
  age: number;
  photoURL: string;
  favoriteMovieIds: string[];
  active: boolean;
}

function jaccard<T>(left: Set<T>, right: Set<T>): number {
  if (left.size === 0 && right.size === 0) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return intersection / (left.size + right.size - intersection);
}

function yearSimilarity(left: Movie[], right: Movie[]): number {
  if (left.length === 0 || right.length === 0) return 0;
  const closestAverage = (source: Movie[], target: Movie[]) =>
    source.reduce((sum, movie) => {
      const gap = Math.min(...target.map((other) => Math.abs(movie.year - other.year)));
      return sum + Math.max(0, 1 - gap / 25);
    }, 0) / source.length;
  return (closestAverage(left, right) + closestAverage(right, left)) / 2;
}

export function calculateMatchScore(
  first: MatchProfile,
  second: MatchProfile,
  movies: Movie[],
): number {
  const byId = new Map(movies.map((movie) => [movie.id, movie]));
  const firstMovies = first.favoriteMovieIds
    .map((id) => byId.get(id))
    .filter((movie): movie is Movie => movie !== undefined);
  const secondMovies = second.favoriteMovieIds
    .map((id) => byId.get(id))
    .filter((movie): movie is Movie => movie !== undefined);

  if (firstMovies.length === 0 || secondMovies.length === 0) return 0;

  const genres = (favorites: Movie[]) => new Set(favorites.flatMap((movie) => movie.genres));
  const actors = (favorites: Movie[]) => new Set(favorites.flatMap((movie) => movie.actors));
  const movieIds = (favorites: Movie[]) => new Set(favorites.map((movie) => movie.id));

  const score =
    jaccard(movieIds(firstMovies), movieIds(secondMovies)) * 0.4 +
    jaccard(genres(firstMovies), genres(secondMovies)) * 0.3 +
    jaccard(actors(firstMovies), actors(secondMovies)) * 0.2 +
    yearSimilarity(firstMovies, secondMovies) * 0.1;

  return score * 100;
}
