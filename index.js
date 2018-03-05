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


	// Sample Expected Response
	let response = {
	  "recommendations" : [
	    {
	      "id": 109,
	      "title": "Reservoir Dogs",
	      "releaseDate": "09-02-1992",
	      "genre": "Action",
	      "averageRating": 4.2,
	      "reviews": 202
	    },
	    {
	      "id": 102,
	      "title": "Jackie Brown",
	      "releaseDate": "09-15-1997",
	      "genre": "Action",
	      "averageRating": 4.1,
	      "reviews": 404
	    },
	    {
	      "id": 85,
	      "title": "True Romance",
	      "releaseDate": "09-25-1993",
	      "genre": "Action",
	      "averageRating": 4.0,
	      "reviews": 165098
	    }
	  ],
	  "meta": {
	    "limit": 10,
	    "offset": 0
	  }
	};

	res.status(200).json(response);
}

module.exports = app;
