jest.mock('../../../db', () => ({ getDb: jest.fn() }));

describe('CourseStore', () => {
  let courses;
  let courseCol;

  beforeEach(() => {
    courses = [];
    courseCol = {
      insertOne: async (doc) => { doc._id = 'c1'; courses.push(doc); return { insertedId: 'c1' }; },
      findOne: async (filter) => courses.find(c => String(c._id) === String(filter._id)),
      find: (filter) => ({ sort: () => ({ toArray: async () => courses.filter(c => filter.status ? c.status === filter.status : true) }) }),
      findOneAndUpdate: async (filter, update) => {
        const c = courses.find(x => String(x._id) === String(filter._id));
        if (c) { Object.assign(c, update.$set); return { value: c }; }
        return { value: null };
      },
      deleteOne: async (filter) => {
        const i = courses.findIndex(c => String(c._id) === String(filter._id));
        if (i >= 0) { courses.splice(i, 1); return { deletedCount: 1 }; }
        return { deletedCount: 0 };
      }
    };
    const dbModule = require('../../../db');
    dbModule.getDb.mockReturnValue({ collection: () => courseCol });
  });

  test('create devuelve el curso con _id', async () => {
    const store = new (require('../store'))();
    const result = await store.create({ title: 'Escalada' });
    expect(result._id).toBe('c1');
  });

  test('findById devuelve el curso', async () => {
    courses.push({ _id: 'c1', title: 'Escalada' });
    const store = new (require('../store'))();
    const found = await store.findById('c1');
    expect(found.title).toBe('Escalada');
  });

  test('findByStatus filtra por estado', async () => {
    let captured;
    courseCol.find = (filter) => { captured = filter; return { sort: () => ({ toArray: async () => [] }) }; };
    const store = new (require('../store'))();
    await store.findByStatus('en_votacion');
    expect(captured).toEqual({ status: 'en_votacion' });
  });

  test('update devuelve el documento actualizado', async () => {
    courses.push({ _id: 'c1', title: 'Escalada', status: 'propuesto' });
    const store = new (require('../store'))();
    const updated = await store.update('c1', { status: 'en_votacion' });
    expect(updated.status).toBe('en_votacion');
  });
});
