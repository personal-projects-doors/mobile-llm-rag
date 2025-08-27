import { Database } from '@nozbe/watermelondb';
import { RAGError, RAGErrorCategory } from './types';

export interface LazyLoadConfig {
  pageSize: number;
  preloadPages: number;
  maxCachedPages: number;
  enablePrefetching: boolean;
  prefetchThreshold: number; // How close to end before prefetching
  enableVirtualization: boolean;
}

export interface PageInfo {
  pageNumber: number;
  items: any[];
  isLoaded: boolean;
  isLoading: boolean;
  lastAccessed: Date;
  size: number; // bytes
}

export interface LazyLoadState {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  loadedPages: Map<number, PageInfo>;
  isInitialized: boolean;
  lastQuery: string;
}

export interface LoadResult<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  nextPage?: number;
  loadTime: number;
}

export class LazyLoader<T = any> {
  private database: Database;
  private config: LazyLoadConfig;
  private state: LazyLoadState;
  private tableName: string;
  private loadingPromises: Map<number, Promise<PageInfo>> = new Map();
  private prefetchQueue: number[] = [];
  private isPrefetching: boolean = false;

  constructor(
    database: Database,
    tableName: string,
    config: Partial<LazyLoadConfig> = {}
  ) {
    this.database = database;
    this.tableName = tableName;
    this.config = {
      pageSize: 50,
      preloadPages: 2,
      maxCachedPages: 10,
      enablePrefetching: true,
      prefetchThreshold: 0.8, // Start prefetching when 80% through current page
      enableVirtualization: true,
      ...config,
    };

    this.state = {
      totalItems: 0,
      totalPages: 0,
      currentPage: 0,
      loadedPages: new Map(),
      isInitialized: false,
      lastQuery: '',
    };
  }

  public async initialize(query?: any): Promise<void> {
    try {
      const queryString = JSON.stringify(query || {});
      
      // Reset state if query changed
      if (this.state.lastQuery !== queryString) {
        this.reset();
        this.state.lastQuery = queryString;
      }

      // Get total count
      const totalCount = await this.getTotalCount(query);
      this.state.totalItems = totalCount;
      this.state.totalPages = Math.ceil(totalCount / this.config.pageSize);
      this.state.isInitialized = true;

      // Preload initial pages
      if (this.config.preloadPages > 0) {
        await this.preloadInitialPages(query);
      }

    } catch (error) {
      throw new RAGError(
        'Failed to initialize lazy loader',
        'LAZY_LOADER_INIT_FAILED',
        RAGErrorCategory.DATABASE,
        { operation: 'lazy_loader_init', tableName: this.tableName },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async getTotalCount(query?: any): Promise<number> {
    try {
      // This would use the actual WatermelonDB count query
      // For now, simulate based on table name
      if (this.tableName === 'rag_documents') {
        const documents = await this.database.get('rag_documents').query().fetch();
        return documents.length;
      } else if (this.tableName === 'rag_chunks') {
        const chunks = await this.database.get('rag_chunks').query().fetch();
        return chunks.length;
      }
      return 0;
    } catch (error) {
      throw new RAGError(
        'Failed to get total count',
        'COUNT_QUERY_FAILED',
        RAGErrorCategory.DATABASE,
        { operation: 'get_total_count', tableName: this.tableName },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async preloadInitialPages(query?: any): Promise<void> {
    const pagesToLoad = Math.min(this.config.preloadPages, this.state.totalPages);
    const loadPromises: Promise<PageInfo>[] = [];

    for (let i = 0; i < pagesToLoad; i++) {
      loadPromises.push(this.loadPage(i, query));
    }

    await Promise.all(loadPromises);
  }

  public async loadPage(pageNumber: number, query?: any): Promise<PageInfo> {
    // Check if page is already loaded
    const existingPage = this.state.loadedPages.get(pageNumber);
    if (existingPage && existingPage.isLoaded) {
      existingPage.lastAccessed = new Date();
      return existingPage;
    }

    // Check if page is currently loading
    const existingPromise = this.loadingPromises.get(pageNumber);
    if (existingPromise) {
      return existingPromise;
    }

    // Start loading the page
    const loadPromise = this.performPageLoad(pageNumber, query);
    this.loadingPromises.set(pageNumber, loadPromise);

    try {
      const pageInfo = await loadPromise;
      this.state.loadedPages.set(pageNumber, pageInfo);
      
      // Manage cache size
      await this.manageCacheSize();
      
      return pageInfo;
    } finally {
      this.loadingPromises.delete(pageNumber);
    }
  }

  private async performPageLoad(pageNumber: number, query?: any): Promise<PageInfo> {
    const startTime = Date.now();
    
    try {
      const offset = pageNumber * this.config.pageSize;
      const limit = this.config.pageSize;

      // Load items from database
      const items = await this.loadItemsFromDatabase(offset, limit, query);
      
      const pageInfo: PageInfo = {
        pageNumber,
        items,
        isLoaded: true,
        isLoading: false,
        lastAccessed: new Date(),
        size: this.estimatePageSize(items),
      };

      const loadTime = Date.now() - startTime;
      console.log(`Loaded page ${pageNumber} with ${items.length} items in ${loadTime}ms`);

      return pageInfo;

    } catch (error) {
      throw new RAGError(
        `Failed to load page ${pageNumber}`,
        'PAGE_LOAD_FAILED',
        RAGErrorCategory.DATABASE,
        { 
          operation: 'load_page', 
          tableName: this.tableName,
          additionalInfo: { pageNumber, offset: pageNumber * this.config.pageSize }
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async loadItemsFromDatabase(offset: number, limit: number, query?: any): Promise<T[]> {
    try {
      let dbQuery = this.database.get(this.tableName).query();
      
      // Apply filters if query is provided
      if (query) {
        // This would apply actual query filters based on the query object
        // For now, just use basic query
      }

      // Apply pagination
      const allItems = await dbQuery.fetch();
      const paginatedItems = allItems.slice(offset, offset + limit);

      // Convert to the expected format
      return paginatedItems.map(item => this.convertDatabaseItem(item));

    } catch (error) {
      throw new RAGError(
        'Database query failed',
        'DATABASE_QUERY_FAILED',
        RAGErrorCategory.DATABASE,
        { operation: 'load_items', tableName: this.tableName },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private convertDatabaseItem(item: any): T {
    // Convert database item to the expected format
    // This would be customized based on the table structure
    if (this.tableName === 'rag_documents') {
      return {
        id: item.id,
        name: item.name,
        filePath: item.filePath,
        size: item.size,
        pageCount: item.pageCount,
        processedAt: item.processedAt,
        isProcessed: item.isProcessed,
        chunkCount: item.chunkCount,
        isEnabled: item.isEnabled,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      } as T;
    } else if (this.tableName === 'rag_chunks') {
      return {
        id: item.id,
        documentId: item.documentId,
        text: item.text,
        pageNumber: item.pageNumber,
        chunkIndex: item.chunkIndex,
        embedding: item.embedding ? JSON.parse(item.embedding) : null,
        startChar: item.startChar,
        endChar: item.endChar,
        tokenCount: item.tokenCount,
        createdAt: item.createdAt,
      } as T;
    }
    
    return item as T;
  }

  private estimatePageSize(items: any[]): number {
    // Estimate memory size of the page
    const jsonString = JSON.stringify(items);
    return jsonString.length * 2; // 2 bytes per character
  }

  private async manageCacheSize(): Promise<void> {
    if (this.state.loadedPages.size <= this.config.maxCachedPages) {
      return;
    }

    // Sort pages by last accessed time (oldest first)
    const sortedPages = Array.from(this.state.loadedPages.entries())
      .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

    // Remove oldest pages until we're under the limit
    const pagesToRemove = this.state.loadedPages.size - this.config.maxCachedPages;
    
    for (let i = 0; i < pagesToRemove; i++) {
      const [pageNumber] = sortedPages[i];
      this.state.loadedPages.delete(pageNumber);
    }
  }

  public async getItems(startIndex: number, count: number, query?: any): Promise<LoadResult<T>> {
    const startTime = Date.now();
    
    if (!this.state.isInitialized) {
      await this.initialize(query);
    }

    const startPage = Math.floor(startIndex / this.config.pageSize);
    const endPage = Math.floor((startIndex + count - 1) / this.config.pageSize);
    
    const items: T[] = [];
    const loadPromises: Promise<PageInfo>[] = [];

    // Load all required pages
    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      loadPromises.push(this.loadPage(pageNum, query));
    }

    const pages = await Promise.all(loadPromises);

    // Extract items from pages
    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      const page = pages[pageNum - startPage];
      const pageStartIndex = pageNum * this.config.pageSize;
      const pageEndIndex = pageStartIndex + this.config.pageSize - 1;
      
      const itemStartInPage = Math.max(0, startIndex - pageStartIndex);
      const itemEndInPage = Math.min(
        this.config.pageSize - 1,
        startIndex + count - 1 - pageStartIndex
      );

      if (itemStartInPage <= itemEndInPage) {
        const pageItems = page.items.slice(itemStartInPage, itemEndInPage + 1);
        items.push(...pageItems);
      }
    }

    // Trigger prefetching if enabled
    if (this.config.enablePrefetching) {
      this.triggerPrefetching(endPage, query);
    }

    const loadTime = Date.now() - startTime;
    
    return {
      items: items.slice(0, count), // Ensure we don't return more than requested
      totalCount: this.state.totalItems,
      hasMore: startIndex + count < this.state.totalItems,
      nextPage: endPage + 1 < this.state.totalPages ? endPage + 1 : undefined,
      loadTime,
    };
  }

  private triggerPrefetching(currentEndPage: number, query?: any): void {
    if (this.isPrefetching) return;

    const nextPage = currentEndPage + 1;
    if (nextPage >= this.state.totalPages) return;

    // Check if we should start prefetching
    const currentProgress = currentEndPage / this.state.totalPages;
    if (currentProgress >= this.config.prefetchThreshold) {
      this.prefetchNextPages(nextPage, query);
    }
  }

  private async prefetchNextPages(startPage: number, query?: any): Promise<void> {
    if (this.isPrefetching) return;
    
    this.isPrefetching = true;
    
    try {
      const pagesToPrefetch = Math.min(
        this.config.preloadPages,
        this.state.totalPages - startPage
      );

      const prefetchPromises: Promise<PageInfo>[] = [];
      
      for (let i = 0; i < pagesToPrefetch; i++) {
        const pageNum = startPage + i;
        if (!this.state.loadedPages.has(pageNum)) {
          prefetchPromises.push(this.loadPage(pageNum, query));
        }
      }

      await Promise.all(prefetchPromises);
      
    } catch (error) {
      console.error('Prefetching failed:', error);
    } finally {
      this.isPrefetching = false;
    }
  }

  public async getItem(index: number, query?: any): Promise<T | null> {
    const result = await this.getItems(index, 1, query);
    return result.items.length > 0 ? result.items[0] : null;
  }

  public async refresh(query?: any): Promise<void> {
    this.reset();
    await this.initialize(query);
  }

  public reset(): void {
    this.state.loadedPages.clear();
    this.loadingPromises.clear();
    this.prefetchQueue = [];
    this.isPrefetching = false;
    this.state.isInitialized = false;
    this.state.totalItems = 0;
    this.state.totalPages = 0;
    this.state.currentPage = 0;
  }

  public getLoadedPageCount(): number {
    return this.state.loadedPages.size;
  }

  public getTotalMemoryUsage(): number {
    let totalSize = 0;
    this.state.loadedPages.forEach(page => {
      totalSize += page.size;
    });
    return totalSize;
  }

  public getState(): LazyLoadState {
    return {
      ...this.state,
      loadedPages: new Map(this.state.loadedPages),
    };
  }

  public async preloadRange(startIndex: number, endIndex: number, query?: any): Promise<void> {
    const startPage = Math.floor(startIndex / this.config.pageSize);
    const endPage = Math.floor(endIndex / this.config.pageSize);
    
    const loadPromises: Promise<PageInfo>[] = [];
    
    for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
      if (!this.state.loadedPages.has(pageNum)) {
        loadPromises.push(this.loadPage(pageNum, query));
      }
    }
    
    await Promise.all(loadPromises);
  }

  public clearCache(): void {
    this.state.loadedPages.clear();
    this.loadingPromises.clear();
  }

  public destroy(): void {
    this.reset();
    this.clearCache();
  }
}