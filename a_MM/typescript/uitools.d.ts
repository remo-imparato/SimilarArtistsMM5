declare class UITools {
	getTracklist(): Tracklist;
	getSelectedTracklist(): Tracklist;
	notMediaListSelected(params: object) : boolean;
	getPureTitle(title: any): string;
	getCanEdit(): boolean;
	getCanDelete(): boolean;
	getHelpContext(el: HTMLElement): string;
	openDialog(name: string, opts: object): Window;
    storeUIState(): void;
}


interface Window {
	uitools: UITools;
}

declare var uitools: UITools;