export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services = new Map<string, any>();

  private constructor() {}

  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  public register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  public get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service "${name}" is not registered in the service locator registry.`);
    }
    return service;
  }

  public clear(): void {
    this.services.clear();
  }
}

export const serviceRegistry = ServiceRegistry.getInstance();
