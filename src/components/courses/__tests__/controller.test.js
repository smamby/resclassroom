const ROLES = require('../../../../common/roles');

// Mocks de dependencias: la lógica de votación y colisiones ya está testeada
// por separado; acá se verifica el comportamiento del controller.
jest.mock('../store');
jest.mock('../../bookings/store');
jest.mock('../../user/store');
jest.mock('../emailService');
jest.mock('../../../common/schedule', () => ({
  expandRecurringDates: jest.fn(() => ['2026-08-04']),
  timesOverlap: jest.fn((d, aS, aE, bS, bE) => aS < bE && aE > bS)
}));

const CourseController = require('../controller');
const CourseStore = require('../store');
const BookingStore = require('../../bookings/store');
const UserStore = require('../../user/store');
const CoursesEmailService = require('../emailService');

function makeReq(user, body, params, query) {
  return { user, body: body || {}, params: params || {}, query: query || {} };
}
function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const baseCourse = {
  _id: 'c1',
  title: 'Escalada',
  proposedBy: 'i1',
  status: 'propuesto',
  votes: [],
  voteDeadline: null,
  schedule: { startDate: '2026-08-03', endDate: '2026-09-30', blocks: [
    { label: 'Teórica', workspaceId: 'w1', isPublicSpace: false, days: [2, 4], startTime: '19:00', endTime: '22:00' }
  ] },
  color: '#3B82F6',
  notes: ''
};

describe('CourseController', () => {
  let ctrl;
  // Los mocks de BookingStore/UserStore/EmailService son objetos compartidos:
  // el controller los instancia en su constructor y los tests verifican esas
  // mismas instancias, así que `new XStore()` debe devolver la misma referencia.
  let bookingMocks;
  let userMocks;
  let emailMocks;

  beforeEach(() => {
    jest.clearAllMocks();
    BookingStore.mockClear();
    bookingMocks = {
      findByWorkspaceAll: jest.fn(async () => []),
      create: jest.fn(async (b) => ({ ...b, _id: 'b1' })),
      confirmPendingByCourse: jest.fn(async () => 1),
      softDeleteByCourse: jest.fn(async () => 1),
      deletePendingByCourse: jest.fn(async () => 1)
    };
    BookingStore.mockImplementation(() => bookingMocks);
    UserStore.mockClear();
    userMocks = {
      findByRole: jest.fn(async () => [{ _id: 's1', email: 's1@mail.com' }, { _id: 's2', email: 's2@mail.com' }]),
      findById: jest.fn(async () => ({ _id: 'i1', email: 'i1@mail.com' }))
    };
    UserStore.mockImplementation(() => userMocks);
    CoursesEmailService.mockClear();
    emailMocks = {
      sendVoteRequest: jest.fn(async () => {}),
      sendApproved: jest.fn(async () => {}),
      sendRejected: jest.fn(async () => {})
    };
    CoursesEmailService.mockImplementation(() => emailMocks);
    ctrl = new CourseController();
  });

  test('createCourse: solo instructor', async () => {
    CourseStore.mockImplementation(() => ({ create: jest.fn(async (c) => ({ ...c, _id: 'c1' })) }));
    ctrl = new CourseController();
    const res = makeRes();
    await ctrl.createCourse(makeReq({ id: 'v1', role: [ROLES.VISITOR] }, { title: 'X' }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    const res2 = makeRes();
    await ctrl.createCourse(makeReq({ id: 'i1', role: [ROLES.INSTRUCTOR] }, { title: 'X' }), res2);
    expect(res2.status).toHaveBeenCalledWith(201);
  });

  test('createCourse: arranca en borrador (propuesto)', async () => {
    let created;
    CourseStore.mockImplementation(() => ({ create: jest.fn(async (c) => { created = c; return { ...c, _id: 'c1' }; }) }));
    ctrl = new CourseController();
    const res = makeRes();
    await ctrl.createCourse(makeReq({ id: 'i1', role: [ROLES.INSTRUCTOR] }, { title: 'Escalada' }), res);
    expect(created.status).toBe('propuesto');
    expect(created.proposedBy).toBe('i1');
  });

  test('listCourses: visitor no ve borradores pero sí publicados', async () => {
    CourseStore.mockImplementation(() => ({ findAll: jest.fn(async () => [
      { ...baseCourse, status: 'propuesto' },
      { ...baseCourse, _id: 'c2', status: 'publicado' }
    ]), update: jest.fn(async () => ({})) }));
    ctrl = new CourseController();
    const res = makeRes();
    await ctrl.listCourses(makeReq(null, {}), res);
    const body = res.json.mock.calls[0][0];
    expect(body.map(c => c._id)).toEqual(['c2']);
  });

  test('updateCourse en borrador: no reinicia votos ni crea bookings', async () => {
    CourseStore.mockImplementation(() => ({
      findById: jest.fn(async () => ({ ...baseCourse })),
      update: jest.fn(async (id, u) => ({ ...baseCourse, ...u, _id: id }))
    }));
    ctrl = new CourseController();
    const res = makeRes();
    await ctrl.updateCourse(makeReq({ id: 'i1', role: [ROLES.INSTRUCTOR] }, { description: 'nueva' }, { id: 'c1' }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    const ctrlStore = new BookingStore();
    expect(ctrlStore.deletePendingByCourse).not.toHaveBeenCalled();
  });

  test('submitCourse crea soft bookings y avisa a SUBCO', async () => {
    CourseStore.mockImplementation(() => ({
      findById: jest.fn(async () => ({ ...baseCourse })),
      update: jest.fn(async (id, u) => ({ ...baseCourse, ...u, _id: id })),
      findById2: undefined
    }));
    // findById se llama dos veces en submit (al inicio y al final)
    const store = new (jest.fn())();
    ctrl = new CourseController();
    const res = makeRes();
    await ctrl.submitCourse(makeReq({ id: 'i1', role: [ROLES.INSTRUCTOR] }, {}, { id: 'c1' }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    const bStore = new BookingStore();
    expect(bStore.create).toHaveBeenCalledTimes(1);
    expect(bStore.create.mock.calls[0][0]).toMatchObject({ status: 'pending', courseId: 'c1', workspaceId: 'w1' });
    const email = new CoursesEmailService();
    expect(email.sendVoteRequest).toHaveBeenCalledTimes(2);
  });

  test('submitCourse rechaza con 409 si hay colisión', async () => {
    BookingStore.mockImplementation(() => ({
      findByWorkspaceAll: jest.fn(async () => [{ _id: 'b1', startDate: '2026-08-04', endDate: '2026-08-04', startTime: '20:00', endTime: '23:00', days: [] }]),
      create: jest.fn()
    }));
    CourseStore.mockImplementation(() => ({ findById: jest.fn(async () => ({ ...baseCourse })), update: jest.fn() }));
    ctrl = new CourseController();
    const res = makeRes();
    await ctrl.submitCourse(makeReq({ id: 'i1', role: [ROLES.INSTRUCTOR] }, {}, { id: 'c1' }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});
