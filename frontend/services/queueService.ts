// Task Queue Management Service
import { GenerationTask, GenerationStatus, GenerationConfig } from '../types';

type QueueProcessor = (task: GenerationTask, config: GenerationConfig) => Promise<void>;

class QueueService {
  private queue: Array<{ task: GenerationTask; config: GenerationConfig }> = [];
  private processing = false;
  private maxConcurrent = 3; // 同时处理最多3个任务
  private activeCount = 0;
  private processor: QueueProcessor | null = null;

  setProcessor(processor: QueueProcessor) {
    this.processor = processor;
  }

  setMaxConcurrent(max: number) {
    this.maxConcurrent = max;
  }

  enqueue(task: GenerationTask, config: GenerationConfig) {
    this.queue.push({ task, config });
    this.processQueue();
  }

  private async processQueue() {
    if (!this.processor) {
      console.error('Queue processor not set');
      return;
    }

    while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const item = this.queue.shift();
      if (!item) break;

      this.activeCount++;
      
      // 异步处理任务
      this.processor(item.task, item.config)
        .catch(error => {
          console.error('Queue processing error:', error);
        })
        .finally(() => {
          this.activeCount--;
          // 继续处理队列中的下一个任务
          this.processQueue();
        });
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  clearQueue() {
    this.queue = [];
  }

  // 批量添加任务
  enqueueBatch(items: Array<{ task: GenerationTask; config: GenerationConfig }>) {
    items.forEach(item => this.queue.push(item));
    this.processQueue();
  }
}

export const queueService = new QueueService();
