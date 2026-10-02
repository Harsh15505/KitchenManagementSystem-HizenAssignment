import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { ACCESS_KEY } from './policies';

/**
 * Fail-closed check at startup: every controller method must declare @Public, @AnyUser or
 * @CheckPolicies. A forgotten decorator stops the app from booting instead of shipping an open
 * endpoint (TRD §5.3).
 */
@Injectable()
export class RouteAccessCheck implements OnApplicationBootstrap {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onApplicationBootstrap(): void {
    const missing = findRoutesWithoutAccessRule(this.discovery, this.scanner, this.reflector);
    if (missing.length > 0) {
      throw new Error(
        `Routes without an access rule (@Public, @AnyUser or @CheckPolicies):\n  ${missing.join('\n  ')}`,
      );
    }
  }
}

export function findRoutesWithoutAccessRule(
  discovery: DiscoveryService,
  scanner: MetadataScanner,
  reflector: Reflector,
): string[] {
  const missing: string[] = [];
  for (const wrapper of discovery.getControllers()) {
    const { instance, metatype } = wrapper;
    if (!instance || !metatype) continue;
    const prototype = Object.getPrototypeOf(instance) as object;
    for (const methodName of scanner.getAllMethodNames(prototype)) {
      const handler = (prototype as Record<string, unknown>)[methodName];
      if (typeof handler !== 'function') continue;
      const isRoute = Reflect.getMetadata('path', handler) !== undefined;
      if (!isRoute) continue;
      const rule = reflector.getAllAndOverride(ACCESS_KEY, [handler, metatype]);
      if (!rule) missing.push(`${metatype.name}.${methodName}`);
    }
  }
  return missing;
}
