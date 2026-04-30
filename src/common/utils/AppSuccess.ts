export class AppSuccess<T> {
  data?: T;
  message?: string;
  statusCode?: number;

  constructor(data: T, message: string, statusCode?: number) {
    this.data = data;
    this.message = message;
    this.statusCode = statusCode || 200;
  }
}
