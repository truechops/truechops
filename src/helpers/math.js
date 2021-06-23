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