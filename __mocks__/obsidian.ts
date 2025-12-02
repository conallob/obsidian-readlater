export class Notice {
  constructor(public message: string, public timeout?: number) {}
  hide() {}
}

export class Plugin {
  app: any;
  manifest: any;

  async loadData(): Promise<any> {
    return {};
  }

  async saveData(data: any): Promise<void> {}

  addRibbonIcon(icon: string, title: string, callback: () => void): any {
    return {};
  }

  addCommand(command: { id: string; name: string; callback: () => void }): void {}

  addSettingTab(tab: any): void {}
}

export class PluginSettingTab {
  constructor(public app: any, public plugin: any) {}
  display(): void {}
}

export class Setting {
  constructor(public containerEl: HTMLElement) {}

  setName(name: string): this {
    return this;
  }

  setDesc(desc: string): this {
    return this;
  }

  addText(callback: (text: any) => void): this {
    callback({
      setPlaceholder: () => ({ setValue: () => ({ onChange: () => {} }) })
    });
    return this;
  }

  addToggle(callback: (toggle: any) => void): this {
    callback({
      setValue: () => ({ onChange: () => {} })
    });
    return this;
  }
}

export class TFile {
  constructor(public path: string) {}
}
