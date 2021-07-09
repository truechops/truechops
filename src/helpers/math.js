export function getPowersOf2(num) {
    return num
      .toString(2) //to binary
      .split("") // to array
      .reverse() //reverse the array
      .reduce((result, value, index) => {
        if (+value) {
          result.push(Math.pow(2, index));
        }

        return result;
      }, []) //get powers of two
  }

  /**
   * Return the additional time (seconds or TrueChops grid time)
   * @param duration
   * @param numDots 
   * @returns 
   */
  export function getAdditionalDotDuration(duration, numDotsIn) {
    let additionalDotTime = 0;
    let additionalTime = duration;
    let numDots = numDotsIn != null ? numDotsIn : 0;
    for(var i = 0; i < numDots; i++) {
      additionalTime /= 2;
      additionalDotTime += additionalTime;
    }

    return additionalDotTime;
  }