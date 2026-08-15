/* ==========================================================================
   RAPIDIN - RATING & REVIEWS ENGINE ⭐️
   ========================================================================== */

class RapidinRatingEngine {
  submitRating(orderId, foodStars, driverStars, comment = '') {
    const ratingObj = {
      orderId,
      foodStars,
      driverStars,
      comment,
      submittedAt: new Date().toISOString()
    };

    const ratings = JSON.parse(localStorage.getItem('rapidin_ratings') || '[]');
    ratings.unshift(ratingObj);
    localStorage.setItem('rapidin_ratings', JSON.stringify(ratings));

    if (window.rapidinSync) {
      window.rapidinSync.emit('RATING_SUBMITTED', ratingObj);
    }

    return ratingObj;
  }

  getRatings() {
    return JSON.parse(localStorage.getItem('rapidin_ratings') || '[]');
  }
}

window.rapidinRating = new RapidinRatingEngine();
