// Public surface of the Students feature module.
// External code should ONLY import from this barrel.
export * from './types';
export { studentsService } from './services/studentsService';
export {
  useStudentsList,
  useStudent,
  useStudentFullProfile,
  useUpdateStudent,
  studentsKeys,
} from './hooks';
