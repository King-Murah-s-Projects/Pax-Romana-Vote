import {CallHandler, ExecutionContext, Injectable, NestInterceptor} from "@nestjs/common";
import {CacheService} from "../cache.service";
import {Reflector} from "@nestjs/core";
import {Observable, of, tap} from "rxjs";
import {CACHE_KEY_METADATA, CACHE_TTL_METADATA} from "@nestjs/cache-manager";

@Injectable()
export class CacheInterceptor implements NestInterceptor {
    constructor(
        private cacheService: CacheService,
        private reflector: Reflector,
    ) {}

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const cacheKey = this.reflector.get<string>(CACHE_KEY_METADATA, context.getHandler());
        const cacheTtl = this.reflector.get<number>(CACHE_TTL_METADATA, context.getHandler());

        if (!cacheKey) {
            return next.handle();
        }

        // Try to get from cache
        const cachedResult = await this.cacheService.get(cacheKey);
        if (cachedResult !== undefined) {
            return of(cachedResult);
        }

        // Execute the method and cache the result
        return next.handle().pipe(
            tap(async (result) => {
                await this.cacheService.set(cacheKey, result, cacheTtl);
            }),
        );
    }
}