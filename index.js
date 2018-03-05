const sqlite = require('sqlite'),
      Sequelize = require('sequelize'),
      request = require('request'),
      bodyParser = require('body-parser'),
      helmet = require('helmet'),
      express = require('express'),
      app = express();

app.enable('trust proxy');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(helmet());

const { PORT=3000, NODE_ENV='development', DB_PATH='./db/database.db' } = process.env;

// START SERVER
Promise.resolve()
  .then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
  .catch((err) => { if (NODE_ENV === 'development') console.error(err.stack); });


// CORS
function allowCrossDomain(req, res, next) {
    if (req.method === "POST" || req.method === "OPTIONS") {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
    }
    next();
};

app.use(allowCrossDomain);

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);

// ROUTE HANDLER
function getFilmRecommendations(req, res) {

	/* STEPS
	1) Get the film ID
	
	2) Get film info (Genre & Release Date)
	
	3) Search database for films that meet Genre and Release Date criteria
	
	4) Get IDs of each "similar" film
	
	5) Ping the reviews API with the IDs of each "similar" film
	
	6) Get length of reviews array to see if there are at least 5 reviews; skip ones that don't have at least 5 reviews
	
	7) If there are 5 reviews, calculate the rating; skip the ones whose ratings are less than 4.0
	
	8) After the object of recommended films is created (thinking key-value pairs with their IDs as keys), iterate over the object to append the values to the response body array
	*/

	// Get the Film ID (STRING)
	// I use parseInt to make it comparable to the ID in the table, which is of data type Integer
	const filmId = parseInt(req.params.id, 10);

	// Establish a connection to the database
	var sequelize = new Sequelize('main', null, null, {
		dialect: 'sqlite',
		storage: 'db/database.db'
	});

	// Authenticate 
	sequelize.authenticate().then(err => {
		if (err) { console.error("Unable to authenticate because", err); }
		console.log('Connection has been established successfully.');
	});

	// Define Film table
	var Films = sequelize.define('films', {
			id: { type: Sequelize.INTEGER, primaryKey: true },
			title: { type: Sequelize.STRING },
			release_date: { type: Sequelize.STRING },
			genre_id: { type: Sequelize.STRING, foreignKey: true }
		},
		{
			timestamps: false,
			classMethods: {
				associate(models) {
					this.hasOne(models.Genres, { foreignKey: 'id' })
				}
			}
		}),
		Genres = sequelize.define('genres', {
			id: { type: Sequelize.INTEGER, primaryKey: true },
			name: { type: Sequelize.STRING }
		},
		{
			timestamps: false,
			classMethods: {
				associate(models) {
					this.hasOne(models.Films, { foreignKey: 'genre_id' })
				}
			}
		});

	// Initialize empty array for responses
	let responseObject = [];

	// Query the Database for the info
	sequelize.query(`SELECT films.id, films.title, films.release_date, films.status, genres.name as genre_name FROM genres LEFT JOIN films ON films.genre_id = genres.id ORDER BY films.id`).then(films => {

    	// console.log(films[0][0]);

    	// Get all of films and with their genre names in place of the ID
		responseObject = films[0].map(film => {

			// Transform the response into an object
			return Object.assign(
				{},
				{
					id: film.id,
					title: film.title,
					releaseDate: film.release_date,
					status: film.status,
					genre: film.genre_name
				}
			)
		});

		// Find the parent film (the movie watched) and all of its children (the movies we might recommend)
		// At this point, we can only sort by genre and the years between release dates between the parent and it's children
		var parentFilm,
			similarMovies = [];
		responseObject.forEach(currentFilm => {
			// If the parent film's ID matches the requested film ID
			if (currentFilm.id === filmId) {
				// Assign that film as the 'requested film'
				parentFilm = currentFilm;
				// Find films that are both the same genre and 15 years from the current film
				responseObject.forEach(childFilm => {
					
					// If the child film has the same genre as the parent film
					if (childFilm.genre === parentFilm.genre) {

						// We check the release date, too
						var parentFilmReleaseDatePieces = parentFilm.releaseDate.split("-"),
						// I do it this way instead of Date#parse because there are inconsistencies across JavaScript implmentations on date parsing
						parentFilmReleaseDateUnixTime = new Date(parentFilmReleaseDatePieces[0], parentFilmReleaseDatePieces[1], parentFilmReleaseDatePieces[2]),
						childFilmReleaseDatePieces = childFilm.releaseDate.split("-"),
						childFilmReleaseDateUnixTime = new Date(childFilmReleaseDatePieces[0], childFilmReleaseDatePieces[1], childFilmReleaseDatePieces[2]),
						// Time in milliseconds, so start with 1 second = 1000 milliseconds * 1 minute * 1 hour * 24 hours * 365 days * 15 years
						fifteenYears = (1000 * 60 * 60 * 24 * 365 * 15),
						yearsBetweenFilms = Math.abs(parentFilmReleaseDateUnixTime - childFilmReleaseDateUnixTime);
						// If there are less than 15 years between the film release dates
						if (yearsBetweenFilms < fifteenYears) {
							// Add the film to the list of child films that we're going to query
							similarMovies.push(childFilm);
						}
					}
				});
			}
		});

		// REQUEST
		// Get movie reviews
		// request({
	 //      uri: `http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1?films=${req.params.id}`,
	 //      method: 'GET'
	 //    }, function (err, response, body) {
	 //    	// If there's an error, send that back
	 //    	if (err) { res.status(response.statusCode).json({ error: err }); }
	 //    	// Otherwise, populate the movieReviews
	 //    	var movieReviews = body;
	 //    	console.log("movieReviews inside", JSON.parse(movieReviews)[0].reviews);



	 //    });

	});

	




	// Sample Expected Response
	// let response = {
	//   "recommendations" : [
	//     {
	//       "id": 109,
	//       "title": "Reservoir Dogs",
	//       "releaseDate": "09-02-1992",
	//       "genre": "Action",
	//       "averageRating": 4.2,
	//       "reviews": 202
	//     },
	//     {
	//       "id": 102,
	//       "title": "Jackie Brown",
	//       "releaseDate": "09-15-1997",
	//       "genre": "Action",
	//       "averageRating": 4.1,
	//       "reviews": 404
	//     },
	//     {
	//       "id": 85,
	//       "title": "True Romance",
	//       "releaseDate": "09-25-1993",
	//       "genre": "Action",
	//       "averageRating": 4.0,
	//       "reviews": 165098
	//     }
	//   ],
	//   "meta": {
	//     "limit": 10,
	//     "offset": 0
	//   }
	// };

	res.status(200).json({ success: true });
}

module.exports = app;
