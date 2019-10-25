var request = require('request');

function createNewMovie(movie_name, movie_token_symbol, movie_description, movie_poster_url, movie_url, movie_price) {
  request.post({
      headers: { 'content-type': 'application/json' },
      url: 'http://localhost:3001/admin/movie',
      body: JSON.stringify({
              name : movie_name,
              symbol: movie_token_symbol,
              description: movie_description,
              posterUrl : movie_poster_url,
              contentUrl : movie_url,
              price : movie_price
            })
  },  function (error, response, body) {
        if (!error && response.statusCode == 200)
          console.log(body);
        else
          console.error(error);
  })
}

createNewMovie( 'Rick and Morty 1',
                'RMS',
                'Rick and Morty Season 1',
                'https://www.clipartwiki.com/clipimg/detail/49-498796_rick-clipart-portal-rick-and-morty-png-portal.png',
                'https://www.youtube.com/watch?v=Rw6BrzB1drs',
                '1'
              )
