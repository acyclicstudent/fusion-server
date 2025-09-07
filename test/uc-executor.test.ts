import 'reflect-metadata';
import { UCExecutor } from '../src/core/classes/uc-executor';
import { UC } from '../src/core/classes/uc';
import { container } from 'tsyringe';

describe('UCExecutor', () => {
  let ucExecutor: UCExecutor;
  
  beforeEach(() => {
    ucExecutor = new UCExecutor();
    container.clearInstances();
    jest.clearAllMocks();
  });

  describe('execute method', () => {
    it('should execute use case with parameters', async () => {
      class TestUseCase extends UC {
        async execute(param1: string, param2: number) {
          return { result: `${param1}-${param2}` };
        }
      }

      // Mock container resolve
      const mockUseCase = new TestUseCase();
      jest.spyOn(container, 'resolve').mockReturnValue(mockUseCase);
      jest.spyOn(mockUseCase, 'execute');

      const result = await ucExecutor.execute(TestUseCase, 'test', 123);

      expect(container.resolve).toHaveBeenCalledWith(TestUseCase);
      expect(mockUseCase.execute).toHaveBeenCalledWith('test', 123);
      expect(result).toEqual({ result: 'test-123' });
    });

    it('should execute use case without parameters', async () => {
      class SimpleUseCase extends UC {
        execute() {
          return { success: true };
        }
      }

      const mockUseCase = new SimpleUseCase();
      jest.spyOn(container, 'resolve').mockReturnValue(mockUseCase);
      jest.spyOn(mockUseCase, 'execute');

      const result = ucExecutor.execute(SimpleUseCase);

      expect(container.resolve).toHaveBeenCalledWith(SimpleUseCase);
      expect(mockUseCase.execute).toHaveBeenCalledWith();
      expect(result).toEqual({ success: true });
    });

    it('should handle async use cases', async () => {
      class AsyncUseCase extends UC {
        async execute(delay: number) {
          return new Promise(resolve => {
            setTimeout(() => resolve({ delayed: true }), delay);
          });
        }
      }

      const mockUseCase = new AsyncUseCase();
      jest.spyOn(container, 'resolve').mockReturnValue(mockUseCase);

      const result = await ucExecutor.execute(AsyncUseCase, 10);

      expect(result).toEqual({ delayed: true });
    });

    it('should preserve use case return type', () => {
      class TypedUseCase extends UC {
        execute(value: string): { message: string } {
          return { message: value };
        }
      }

      const mockUseCase = new TypedUseCase();
      jest.spyOn(container, 'resolve').mockReturnValue(mockUseCase);

      const result = ucExecutor.execute(TypedUseCase, 'hello');

      expect(result).toEqual({ message: 'hello' });
    });

    it('should handle use case with dependencies', async () => {
      interface Repository {
        save(data: any): Promise<any>;
      }

      class UseCaseWithDeps extends UC {
        constructor(private repository: Repository) {
          super();
        }

        async execute(data: any) {
          return await this.repository.save(data);
        }
      }

      const data = { name: 'test' };
      
      const mockRepository = {
        save: jest.fn().mockResolvedValue({ id: 1, ...data })
      };

      const mockUseCase = new UseCaseWithDeps(mockRepository);
      jest.spyOn(container, 'resolve').mockReturnValue(mockUseCase);
      const result = await ucExecutor.execute(UseCaseWithDeps, data);

      expect(container.resolve).toHaveBeenCalledWith(UseCaseWithDeps);
      expect(mockRepository.save).toHaveBeenCalledWith(data);
      expect(result).toEqual({ id: 1, name: 'test' });
    });

    it('should propagate use case errors', async () => {
      class ErrorUseCase extends UC {
        execute() {
          throw new Error('Use case failed');
        }
      }

      const mockUseCase = new ErrorUseCase();
      jest.spyOn(container, 'resolve').mockReturnValue(mockUseCase);

      expect(() => {
        ucExecutor.execute(ErrorUseCase);
      }).toThrow('Use case failed');
    });

    it('should propagate async use case errors', async () => {
      class AsyncErrorUseCase extends UC {
        async execute() {
          throw new Error('Async use case failed');
        }
      }

      const mockUseCase = new AsyncErrorUseCase();
      jest.spyOn(container, 'resolve').mockReturnValue(mockUseCase);

      await expect(ucExecutor.execute(AsyncErrorUseCase)).rejects.toThrow('Async use case failed');
    });
  });
});

describe('UC Abstract Class', () => {
  describe('inheritance', () => {
    it('should require execute method implementation', () => {
      class ConcreteUseCase extends UC {
        execute(param: string): string {
          return `executed: ${param}`;
        }
      }

      const useCase = new ConcreteUseCase();
      const result = useCase.execute('test');

      expect(result).toBe('executed: test');
    });

    it('should allow async execute method', async () => {
      class AsyncConcreteUseCase extends UC {
        async execute(param: string): Promise<string> {
          return `async executed: ${param}`;
        }
      }

      const useCase = new AsyncConcreteUseCase();
      const result = await useCase.execute('test');

      expect(result).toBe('async executed: test');
    });

    it('should allow multiple parameters', () => {
      class MultiParamUseCase extends UC {
        execute(param1: string, param2: number, param3: boolean): any {
          return { param1, param2, param3 };
        }
      }

      const useCase = new MultiParamUseCase();
      const result = useCase.execute('test', 123, true);

      expect(result).toEqual({ param1: 'test', param2: 123, param3: true });
    });

    it('should allow no parameters', () => {
      class NoParamUseCase extends UC {
        execute(): string {
          return 'no params';
        }
      }

      const useCase = new NoParamUseCase();
      const result = useCase.execute();

      expect(result).toBe('no params');
    });
  });
});

describe('Integration: UCExecutor + UC', () => {
  let ucExecutor: UCExecutor;
  
  beforeEach(() => {
    ucExecutor = new UCExecutor();
    container.clearInstances();
  });

  it('should integrate with dependency injection container', async () => {
    class SimpleUseCase extends UC {
      execute(message: string) {
        return { message: `Processed: ${message}` };
      }
    }

    // Mock container resolution
    const mockUseCase = new SimpleUseCase();
    jest.spyOn(container, 'resolve').mockReturnValue(mockUseCase);
    jest.spyOn(mockUseCase, 'execute');

    const result = ucExecutor.execute(SimpleUseCase, 'hello');

    expect(container.resolve).toHaveBeenCalledWith(SimpleUseCase);
    expect(mockUseCase.execute).toHaveBeenCalledWith('hello');
    expect(result).toEqual({ message: 'Processed: hello' });
  });
});