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

  test('updateCourse en votación: rechaza con 409 si la nueva grilla colisiona', async () => {
    bookingMocks.findByWorkspaceAll.mockResolvedValue([
      { _id: 'b1', startDate: '2026-08-04', endDate: '2026-08-04', startTime: '20:00', endTime: '23:00', days: [] }
    ]);
    CourseStore.mockImplementation(() => ({
      findById: jest.fn(async () => ({ ...baseCourse, status: 'en_votacion', voteDeadline: Date.now() + 3600000, votes: [] })),
      update: jest.fn(async (id, u) => ({ ...baseCourse, ...u, _id: id }))
    }));
    ctrl = new CourseController();
    const res = makeRes();
    await ctrl.updateCourse(makeReq({ id: 'i1', role: [ROLES.INSTRUCTOR] }, { schedule: baseCourse.schedule }, { id: 'c1' }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(bookingMocks.deletePendingByCourse).not.toHaveBeenCalled();
  });
});

describe('CourseController vote/withdraw/cancel', () => {
  let ctrl;
  // Mismos mocks compartidos que el describe anterior: al sobreescribir
  // CourseStore se reconstruye el controller para que use el nuevo store.
  let bookingMocks;
  let userMocks;
  let emailMocks;

  beforeEach(() => {
    jest.clearAllMocks();
    bookingMocks = {
      findByWorkspaceAll: jest.fn(async () => []),
      create: jest.fn(async (b) => ({ ...b, _id: 'b1' })),
      confirmPendingByCourse: jest.fn(async () => 1),
      softDeleteByCourse: jest.fn(async () => 1),
      deletePendingByCourse: jest.fn(async () => 1)
    };
    BookingStore.mockImplementation(() => bookingMocks);
    userMocks = {
      findByRole: jest.fn(async () => [
        { _id: 's1', email: 's1@mail.com' },
        { _id: 's2', email: 's2@mail.com' },
        { _id: 's3', email: 's3@mail.com' },
        { _id: 's4', email: 's4@mail.com' }
      ]),
      findById: jest.fn(async () => ({ _id: 'i1', email: 'i1@mail.com' }))
    };
    UserStore.mockImplementation(() => userMocks);
    emailMocks = {
      sendVoteRequest: jest.fn(async () => {}),
      sendApproved: jest.fn(async () => {}),
      sendRejected: jest.fn(async () => {})
    };
    CoursesEmailService.mockImplementation(() => emailMocks);
    ctrl = new CourseController();
  });

  function votingCourse() {
    return { ...baseCourse, status: 'en_votacion', voteDeadline: new Date(Date.now() + 3600 * 1000), votes: [] };
  }

  test('voteCourse: solo subco', async () => {
    CourseStore.mockImplementation(() => ({ findById: jest.fn(async () => votingCourse()), update: jest.fn(async () => ({})) }));
    ctrl = new CourseController();
    const res = makeRes();
    await ctrl.voteCourse(makeReq({ id: 'i1', role: [ROLES.INSTRUCTOR] }, { vote: 'positive' }, { id: 'c1' }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('voteCourse: reemplaza el voto previo del usuario', async () => {
    const existing = votingCourse();
    existing.votes = [{ userId: 's1', vote: 'negative', comment: '', votedAt: new Date() }];
    let saved;
    CourseStore.mockImplementation(() => ({
      findById: jest.fn(async () => existing),
      update: jest.fn(async (id, u) => { saved = u; return { ...existing, ...u }; })
    }));
    ctrl = new CourseController();
    const res = makeRes();
    await ctrl.voteCourse(makeReq({ id: 's1', role: [ROLES.SUBCO] }, { vote: 'positive' }, { id: 'c1' }), res);
    expect(saved.votes).toHaveLength(1);
    expect(saved.votes[0].vote).toBe('positive');
  });

  test('voteCourse: al votar todos se aprueba y se confirman los soft bookings', async () => {
    const existing = votingCourse();
    existing.votes = [
      { userId: 's2', vote: 'positive', comment: '', votedAt: new Date() },
      { userId: 's3', vote: 'positive', comment: '', votedAt: new Date() },
      { userId: 's4', vote: 'positive', comment: '', votedAt: new Date() }
    ];
    CourseStore.mockImplementation(() => ({ findById: jest.fn(async () => existing), update: jest.fn(async (id, u) => ({ ...existing, ...u })) }));
    ctrl = new CourseController();
    const res = makeRes();
    await ctrl.voteCourse(makeReq({ id: 's1', role: [ROLES.SUBCO] }, { vote: 'positive' }, { id: 'c1' }), res);
    expect(bookingMocks.confirmPendingByCourse).toHaveBeenCalledWith('c1');
    expect(emailMocks.sendApproved).toHaveBeenCalled();
  });

  test('withdrawCourse: solo creador y en votación', async () => {
    CourseStore.mockImplementation(() => ({ findById: jest.fn(async () => votingCourse()), update: jest.fn(async () => ({})) }));
    ctrl = new CourseController();
    const res = makeRes();
    await ctrl.withdrawCourse(makeReq({ id: 'otro', role: [ROLES.INSTRUCTOR] }, {}, { id: 'c1' }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    const res2 = makeRes();
    await ctrl.withdrawCourse(makeReq({ id: 'i1', role: [ROLES.INSTRUCTOR] }, {}, { id: 'c1' }), res2);
    expect(bookingMocks.softDeleteByCourse).toHaveBeenCalledWith('c1');
  });

  test('cancelCourse libera las reservas', async () => {
    const pub = { ...baseCourse, status: 'publicado' };
    CourseStore.mockImplementation(() => ({ findById: jest.fn(async () => pub), update: jest.fn(async () => ({})) }));
    ctrl = new CourseController();
    const res = makeRes();
    await ctrl.cancelCourse(makeReq({ id: 'i1', role: [ROLES.INSTRUCTOR] }, {}, { id: 'c1' }), res);
    expect(bookingMocks.softDeleteByCourse).toHaveBeenCalledWith('c1');
  });

  test('pendingCount: cuenta votaciones abiertas sin mi voto', async () => {
    const a = votingCourse();
    const b = votingCourse();
    b._id = 'c2';
    b.votes = [{ userId: 's1', vote: 'positive', comment: '', votedAt: new Date() }];
    CourseStore.mockImplementation(() => ({ findAll: jest.fn(async () => [a, b]), update: jest.fn(async () => ({})) }));
    ctrl = new CourseController();
    const res = makeRes();
    await ctrl.pendingCount(makeReq({ id: 's1', role: [ROLES.SUBCO] }, {}, {}), res);
    expect(res.json.mock.calls[0][0]).toEqual({ count: 1 });
  });

  test('checkConflicts devuelve colisiones', async () => {
    bookingMocks.findByWorkspaceAll.mockResolvedValue([
      { _id: 'b1', startDate: '2026-08-04', endDate: '2026-08-04', startTime: '20:00', endTime: '23:00', days: [] }
    ]);
    const res = makeRes();
    await ctrl.checkConflicts(makeReq({ id: 'i1', role: [ROLES.INSTRUCTOR] }, {}, {}, { workspaceId: 'w1', startDate: '2026-08-03', endDate: '2026-08-09', days: '2,4', startTime: '19:00', endTime: '22:00' }), res);
    const body = res.json.mock.calls[0][0];
    expect(body.conflicts.length).toBeGreaterThan(0);
  });

  test('voteCourse: rechaza voto después del vencimiento', async () => {
    const expired = { ...baseCourse, status: 'en_votacion', voteDeadline: new Date(Date.now() - 1000), votes: [] };
    CourseStore.mockImplementation(() => ({ findById: jest.fn(async () => expired), update: jest.fn(async () => ({})) }));
    ctrl = new CourseController();
    const res = makeRes();
    await ctrl.voteCourse(makeReq({ id: 's1', role: [ROLES.SUBCO] }, { vote: 'positive' }, { id: 'c1' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(bookingMocks.confirmPendingByCourse).not.toHaveBeenCalled();
  });

  test('backToDraft: vuelve rechazado a borrador', async () => {
    const rejected = { ...baseCourse, status: 'rechazado' };
    let saved;
    CourseStore.mockImplementation(() => ({
      findById: jest.fn(async () => rejected),
      update: jest.fn(async (id, u) => { saved = u; return { ...rejected, ...u }; })
    }));
    ctrl = new CourseController();
    const res = makeRes();
    await ctrl.backToDraft(makeReq({ id: 'i1', role: [ROLES.INSTRUCTOR] }, {}, { id: 'c1' }), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(bookingMocks.deletePendingByCourse).toHaveBeenCalledWith('c1');
    expect(saved.status).toBe('propuesto');
    expect(saved.votes).toEqual([]);
  });

  test('deleteCourse: solo borradores y solo creador', async () => {
    const publicado = { ...baseCourse, status: 'publicado' };
    CourseStore.mockImplementation(() => ({ findById: jest.fn(async () => publicado), delete: jest.fn(async () => ({})) }));
    ctrl = new CourseController();
    const res = makeRes();
    await ctrl.deleteCourse(makeReq({ id: 'i1', role: [ROLES.INSTRUCTOR] }, {}, { id: 'c1' }), res);
    expect(res.status).toHaveBeenCalledWith(400);

    const propuesto = { ...baseCourse, status: 'propuesto' };
    CourseStore.mockImplementation(() => ({ findById: jest.fn(async () => propuesto), delete: jest.fn(async () => ({})) }));
    ctrl = new CourseController();
    const res2 = makeRes();
    await ctrl.deleteCourse(makeReq({ id: 'otro', role: [ROLES.INSTRUCTOR] }, {}, { id: 'c1' }), res2);
    expect(res2.status).toHaveBeenCalledWith(403);

    let deleted;
    CourseStore.mockImplementation(() => ({
      findById: jest.fn(async () => propuesto),
      delete: jest.fn(async (id) => { deleted = id; return {}; })
    }));
    ctrl = new CourseController();
    const res3 = makeRes();
    await ctrl.deleteCourse(makeReq({ id: 'i1', role: [ROLES.INSTRUCTOR] }, {}, { id: 'c1' }), res3);
    expect(res3.status).toHaveBeenCalledWith(200);
    expect(bookingMocks.deletePendingByCourse).toHaveBeenCalledWith('c1');
    expect(deleted).toBe('c1');
  });
});
