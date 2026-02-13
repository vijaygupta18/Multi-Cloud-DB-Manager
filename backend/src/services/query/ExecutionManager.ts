import logger from '../../utils/logger';
import { QueryResponse } from '../../types';

// Track active executions for cancellation support
interface ActiveExecution {
  executionId: string;
  clients: Map<string, { client: any; backendPid?: number }>;
  startTime: number;
  cancelled: boolean;
}

/**
 * Execution result storage for async queries
 */
export interface ExecutionResult {
  executionId: string;
  userId?: string; // Track which user started this execution
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  result?: QueryResponse;
  error?: string;
  progress?: {
    currentStatement: number;
    totalStatements: number;
    currentStatementText?: string;
  };
  startTime: number;
  endTime?: number;
}

/**
 * ExecutionManager - Manages query execution state, results, and cleanup
 * Implements LRU eviction to prevent memory leaks
 */
export class ExecutionManager {
  private activeExecutions: Map<string, ActiveExecution> = new Map();
  private executionResults: Map<string, ExecutionResult> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private maxResultsSize: number;
  private maxResultsAge: number;
  private maxActiveAge: number;

  constructor(
    maxResultsSize: number = 1000,
    maxResultsAge: number = 30 * 60 * 1000, // 30 minutes
    maxActiveAge: number = 30 * 60 * 1000 // 30 minutes
  ) {
    this.maxResultsSize = maxResultsSize;
    this.maxResultsAge = maxResultsAge;
    this.maxActiveAge = maxActiveAge;
    
    // Cleanup old results every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Stop the execution manager and cleanup resources
   */
  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Initialize a new execution
   */
  public initializeExecution(executionId: string, userId?: string): void {
    this.executionResults.set(executionId, {
      executionId,
      userId,
      status: 'running',
      startTime: Date.now(),
      progress: {
        currentStatement: 0,
        totalStatements: 0
      }
    });

    // Check if we need to evict old results
    this.enforceMaxSize();
  }

  /**
   * Get execution status
   */
  public getExecutionStatus(executionId: string): ExecutionResult | null {
    return this.executionResults.get(executionId) || null;
  }

  /**
   * Get active execution
   */
  public getActiveExecution(executionId: string): ActiveExecution | undefined {
    return this.activeExecutions.get(executionId);
  }

  /**
   * Register an active execution with its clients
   */
  public registerActiveExecution(
    executionId: string,
    cloudKey: string,
    client: any,
    backendPid?: number
  ): void {
    let execution = this.activeExecutions.get(executionId);
    if (!execution) {
      execution = {
        executionId,
        clients: new Map(),
        startTime: Date.now(),
        cancelled: false
      };
      this.activeExecutions.set(executionId, execution);
    }
    execution.clients.set(cloudKey, { client, backendPid });
  }

  /**
   * Mark execution as cancelled
   */
  public markAsCancelled(executionId: string): boolean {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }

    execution.cancelled = true;
    
    // Update result status
    const result = this.executionResults.get(executionId);
    if (result) {
      result.status = 'cancelled';
      result.endTime = Date.now();
    }

    return true;
  }

  /**
   * Get all active executions for a cloud
   */
  public getActiveExecutions(): Array<{ executionId: string; startTime: number; duration_ms: number }> {
    const now = Date.now();
    return Array.from(this.activeExecutions.values()).map(exec => ({
      executionId: exec.executionId,
      startTime: exec.startTime,
      duration_ms: now - exec.startTime
    }));
  }

  /**
   * Get all backend PIDs for an execution
   */
  public getBackendPids(executionId: string): Array<{ cloudKey: string; pid: number }> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return [];
    }

    const pids: Array<{ cloudKey: string; pid: number }> = [];
    for (const [cloudKey, clientInfo] of execution.clients.entries()) {
      if (clientInfo.backendPid) {
        pids.push({ cloudKey, pid: clientInfo.backendPid });
      }
    }
    return pids;
  }

  /**
   * Update execution progress
   */
  public updateProgress(
    executionId: string,
    currentStatement: number,
    totalStatements: number,
    currentStatementText?: string
  ): void {
    const result = this.executionResults.get(executionId);
    if (result) {
      result.progress = {
        currentStatement,
        totalStatements,
        currentStatementText
      };
    }
  }

  /**
   * Complete execution with result (includes partial results when cancelled)
   */
  public completeExecution(
    executionId: string,
    response: QueryResponse,
    success: boolean
  ): void {
    const result = this.executionResults.get(executionId);
    if (result) {
      // Always save the result/partial result
      result.result = response;
      
      // Only update status if not already cancelled
      if (result.status !== 'cancelled') {
        result.status = success ? 'completed' : 'failed';
      }
      
      result.endTime = Date.now();
    }
  }

  /**
   * Complete execution with error
   */
  public failExecution(executionId: string, error: string): void {
    const result = this.executionResults.get(executionId);
    if (result) {
      // Don't overwrite if already cancelled
      if (result.status !== 'cancelled') {
        result.status = 'failed';
        result.error = error;
        result.endTime = Date.now();
      }
    }
  }

  /**
   * Release a client for an execution
   */
  public releaseClient(executionId: string, cloudKey: string): void {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.clients.delete(cloudKey);
      // Only delete the execution entry if all clients are released
      if (execution.clients.size === 0) {
        this.activeExecutions.delete(executionId);
      }
    }
  }

  /**
   * Check if execution was cancelled
   */
  public isCancelled(executionId: string): boolean {
    const execution = this.activeExecutions.get(executionId);
    return execution?.cancelled || false;
  }

  /**
   * Cleanup old executions and results
   */
  private cleanup(): void {
    const now = Date.now();
    
    // Cleanup completed execution results
    for (const [id, result] of this.executionResults.entries()) {
      if (result.endTime && (now - result.endTime > this.maxResultsAge)) {
        this.executionResults.delete(id);
      }
    }
    
    // Cleanup stale active executions (safety check)
    for (const [id, execution] of this.activeExecutions.entries()) {
      if (now - execution.startTime > this.maxActiveAge) {
        logger.warn('Cleaning up stale active execution', { 
          executionId: id, 
          duration: now - execution.startTime 
        });
        this.activeExecutions.delete(id);
      }
    }
  }

  /**
   * Enforce maximum results size with LRU eviction
   */
  private enforceMaxSize(): void {
    if (this.executionResults.size <= this.maxResultsSize) {
      return;
    }

    // Sort by endTime (oldest first), running executions at the end
    const entries = Array.from(this.executionResults.entries());
    entries.sort((a, b) => {
      // Running executions (no endTime) should be kept
      if (!a[1].endTime) return 1;
      if (!b[1].endTime) return -1;
      return a[1].endTime - b[1].endTime;
    });

    // Remove oldest entries until we're under the limit
    const toRemove = entries.length - this.maxResultsSize;
    for (let i = 0; i < toRemove; i++) {
      const [id] = entries[i];
      // Don't remove running executions
      if (entries[i][1].endTime) {
        this.executionResults.delete(id);
      }
    }

    if (toRemove > 0) {
      logger.info('LRU eviction performed', { 
        removed: toRemove, 
        remaining: this.executionResults.size 
      });
    }
  }
}

export default ExecutionManager;
