export interface Movie {
  id: string;
  title: string;
  year: number;
  genres: string[];
  actors: string[];
  posterUrl?: string;
  overview: string;
}

export const starterMovies: Movie[] = [
  {
    id: "inception",
    title: "Inception",
    year: 2010,
    genres: ["Science-fiction", "Action", "Thriller"],
    actors: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page"],
    posterUrl: "https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg",
    overview: "Un voleur spécialisé dans l'extraction de secrets pénètre les rêves de ses cibles.",
  },
  {
    id: "interstellar",
    title: "Interstellar",
    year: 2014,
    genres: ["Science-fiction", "Aventure", "Drame"],
    actors: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"],
    posterUrl: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    overview: "Une équipe d'explorateurs cherche un nouvel avenir pour l'humanité au-delà des étoiles.",
  },
  {
    id: "the-dark-knight",
    title: "The Dark Knight",
    year: 2008,
    genres: ["Action", "Crime", "Drame"],
    actors: ["Christian Bale", "Heath Ledger", "Gary Oldman"],
    posterUrl: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    overview: "Batman affronte un criminel qui plonge Gotham dans le chaos.",
  },
  {
    id: "parasite",
    title: "Parasite",
    year: 2019,
    genres: ["Thriller", "Drame", "Comédie"],
    actors: ["Song Kang-ho", "Lee Sun-kyun", "Cho Yeo-jeong"],
    posterUrl: "https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    overview: "La rencontre de deux familles aux modes de vie radicalement différents.",
  },
  {
    id: "pulp-fiction",
    title: "Pulp Fiction",
    year: 1994,
    genres: ["Crime", "Drame", "Thriller"],
    actors: ["John Travolta", "Samuel L. Jackson", "Uma Thurman"],
    posterUrl: "https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg",
    overview: "Les destins de personnages hauts en couleur s'entrecroisent à Los Angeles.",
  },
  {
    id: "amelie",
    title: "Le Fabuleux Destin d'Amélie Poulain",
    year: 2001,
    genres: ["Comédie", "Romance"],
    actors: ["Audrey Tautou", "Mathieu Kassovitz", "Rufus"],
    posterUrl: "https://image.tmdb.org/t/p/w500/oTKduWL2tpIKEmkAqF4mFEAWAsv.jpg",
    overview: "À Montmartre, Amélie décide de changer discrètement la vie de ceux qui l'entourent.",
  },
  {
    id: "spider-man-into-the-spider-verse",
    title: "Spider-Man: New Generation",
    year: 2018,
    genres: ["Animation", "Action", "Aventure"],
    actors: ["Shameik Moore", "Jake Johnson", "Hailee Steinfeld"],
    posterUrl: "https://image.tmdb.org/t/p/w500/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg",
    overview: "Miles Morales découvre qu'il n'est pas le seul Spider-Man de son univers.",
  },
  {
    id: "get-out",
    title: "Get Out",
    year: 2017,
    genres: ["Horreur", "Mystère", "Thriller"],
    actors: ["Daniel Kaluuya", "Allison Williams", "Bradley Whitford"],
    posterUrl: "https://image.tmdb.org/t/p/w500/tFXcEccSQMf3lfhfXKSU9iRBpa3.jpg",
    overview: "Un week-end chez la belle-famille prend une tournure inquiétante.",
  },
];
