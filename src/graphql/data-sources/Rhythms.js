import { MongoDataSource } from 'apollo-datasource-mongodb'

export default class Rhythms extends MongoDataSource {
  getRhythm(rhythmId) {
    return this.findOneById(rhythmId)
  }

    async getAll(query) {
    const result = await this.collection.find(query).toArray();
    return result
  }
}

// export default class Rhythms {
//   constructor({ collection }) {
//     this.collection = collection;
//   }

//   async getAll(query) {
//     console.lo
//     return await this.collection.find(query).toArray();
//   }
// }