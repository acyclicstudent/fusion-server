export interface EvtListener {
    handle<T = any>(event: T): any;
}