import { MongoDataSource } from 'apollo-datasource-mongodb';

export default class Links extends MongoDataSource {
  getLinkById(linkId) {
    return this.findOneById(linkId);
  }

  async findOne(query) {
    return this.collection.findOne(query);
  }

  async findMany({ query = {}, sortBy = {}, limit = 100 } = {}) {
    return this.collection.find(query).sort(sortBy).limit(limit).toArray();
  }

  async insertOne(link) {
    console.log(`insertOne: ${JSON.stringify(link)}`)
    const result = await this.collection.insertOne(link);
    return { ...link, _id: result.insertedId };
  }

  async insertMany(links) {
    const result = await this.collection.insertMany(links);
    return { insertedIds: Object.values(result.insertedIds) };
  }

  async deleteOne(query) {
    return this.collection.findOneAndDelete(query).then(res => res.value);
  }

  async deleteMany(query) {
    const result = await this.collection.deleteMany(query);
    return { deletedCount: result.deletedCount };
  }
}
