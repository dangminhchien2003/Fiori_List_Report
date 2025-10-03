import { FilterBar$FilterChangedEventParameters } from "sap/fe/macros/filterBar/FilterBar";
import Label from "sap/m/Label";
import MultiComboBox from "sap/m/MultiComboBox";
import Table from "sap/m/Table";
import FilterBar from "sap/ui/comp/filterbar/FilterBar";
import FilterGroupItem from "sap/ui/comp/filterbar/FilterGroupItem";
import PersonalizableInfo from "sap/ui/comp/smartvariants/PersonalizableInfo";
import SmartVariantManagement from "sap/ui/comp/smartvariants/SmartVariantManagement";
import Controller from "sap/ui/core/mvc/Controller";
import Filter from "sap/ui/model/Filter";
import FilterOperator from "sap/ui/model/FilterOperator";
import JSONModel from "sap/ui/model/json/JSONModel";
import ListBinding from "sap/ui/model/ListBinding";

interface FilterData {
  groupName: string;
  fieldName: string;
  fieldData: string[];
}

/**
 * @namespace listreport.controller
 */
export default class DynamicPageListReport extends Controller {
  private oModel?: JSONModel | null;
  private oSmartVariantManagement?: SmartVariantManagement | null;
  private oExpandedLabel?: Label | null;
  private oSnappedLabel?: Label | null;
  private oFilterBar?: FilterBar | null;
  private oTable?: Table | null;

  public onInit(): void {
    this.oModel = new JSONModel();
    void this.oModel.loadData(
      sap.ui.require.toUrl("listreport/model/model.json"),
      undefined,
      false
    );
    this.getView()?.setModel(this.oModel);

    this.fetchData = this.fetchData.bind(this);
    this.applyData = this.applyData.bind(this);
    this.getFiltersWithValues = this.getFiltersWithValues.bind(this);

    this.oSmartVariantManagement = this.getView()?.byId(
      "svm"
    ) as SmartVariantManagement;
    this.oExpandedLabel = this.getView()?.byId("expandedLabel") as Label;
    this.oSnappedLabel = this.getView()?.byId("snappedLabel") as Label;
    this.oFilterBar = this.getView()?.byId("filterBar") as FilterBar;
    this.oTable = this.getView()?.byId("table") as Table;

    this.oFilterBar?.registerFetchData(this.fetchData.bind(this));
    this.oFilterBar?.registerApplyData((aData: unknown) => {
      this.applyData(aData as FilterData[]);
    });
    this.oFilterBar.registerGetFiltersWithValues(
      this.getFiltersWithValues.bind(this)
    );

    const oPersInfo = new PersonalizableInfo({
      type: "filterBar",
      keyName: "persistencyKey",
      dataSource: "",
      control: this.oFilterBar,
    });
    this.oSmartVariantManagement.addPersonalizableControl(oPersInfo);
    this.oSmartVariantManagement.initialise(function () {}, this.oFilterBar);
  }

  public onExit(): void {
    this.oModel = null;
    this.oSmartVariantManagement = null;
    this.oExpandedLabel = null;
    this.oSnappedLabel = null;
    this.oFilterBar = null;
    this.oTable = null;
  }

  public fetchData(): FilterData[] {
    if (!this.oFilterBar) {
      return [];
    }

    const aData = this.oFilterBar
      .getAllFilterItems(true)
      .reduce<FilterData[]>((aResult, oFilterItem) => {
        const oControl = oFilterItem.getControl();
        if (oControl instanceof MultiComboBox) {
          aResult.push({
            groupName: oFilterItem.getGroupName() ?? "",
            fieldName: oFilterItem.getName() ?? "",
            fieldData: oControl.getSelectedKeys() ?? [],
          });
        }
        return aResult;
      }, []);

    return aData;
  }

  public applyData(aData: FilterData[]): void {
    aData.forEach((oDataObject) => {
      const oControl = this.oFilterBar!.determineControlByName(
        oDataObject.fieldName,
        oDataObject.groupName
      );
      if (oControl && "setSelectedKeys" in oControl) {
        (oControl as MultiComboBox).setSelectedKeys(oDataObject.fieldData);
      }
    });
  }

  public getFiltersWithValues(): FilterGroupItem[] {
    if (!this.oFilterBar) {
      return [];
    }

    const aFiltersWithValue = this.oFilterBar
      ?.getFilterGroupItems()
      .reduce<FilterGroupItem[]>((aResult, oFilterGroupItem) => {
        const oControl = oFilterGroupItem.getControl();

        // Kiểm tra xem control có phải MultiComboBox và có selectedKeys
        if (
          oControl instanceof MultiComboBox &&
          oControl.getSelectedKeys().length > 0
        ) {
          aResult.push(oFilterGroupItem);
        }

        return aResult;
      }, []);

    return aFiltersWithValue;
  }

  public onSelectionChange(oEvent: Event): void {
    this.oSmartVariantManagement?.currentVariantSetModified(true);
    this.oFilterBar?.fireFilterChange(
      oEvent as FilterBar$FilterChangedEventParameters
    );
  }

  public onSearch(): void {
    if (!this.oFilterBar || !this.oTable) {
      return;
    }

    const aTableFilters = this.oFilterBar
      .getFilterGroupItems()
      .reduce<Filter[]>((aResult, oFilterGroupItem: FilterGroupItem) => {
        const oControl = oFilterGroupItem.getControl();

        if (oControl instanceof MultiComboBox) {
          const aSelectedKeys = oControl.getSelectedKeys();

          const aFilters = aSelectedKeys.map(
            (sSelectedKey: string) =>
              new Filter({
                path: oFilterGroupItem.getName() ?? "",
                operator: FilterOperator.Contains,
                value1: sSelectedKey,
              })
          );
          if (aSelectedKeys.length > 0) {
            aResult.push(
              new Filter({
                filters: aFilters,
                and: false,
              })
            );
          }
        }

        return aResult;
      }, []);

    // Áp dụng filter vào bảng
    const oBinding = this.oTable.getBinding("items") as ListBinding;
    oBinding.filter(aTableFilters);

    this.oTable.setShowOverlay(false);
  }

  public onFilterChange(): void {
    this._updateLabelsAndTable();
  }

  public onAfterVariantLoad(): void {
    this._updateLabelsAndTable();
  }

  public getFormattedSummaryText(): string {
    if (!this.oFilterBar) {
      return "No active";
    }

    const aFiltersWithValues = this.oFilterBar?.retrieveFiltersWithValues();
    if (aFiltersWithValues?.length === 0) {
      return "No filters active";
    }

    if (aFiltersWithValues?.length === 1) {
      return (
        aFiltersWithValues.length +
        " filter active " +
        aFiltersWithValues.join(",")
      );
    }

    return (
      aFiltersWithValues.length +
      " filters active" +
      aFiltersWithValues.join(",")
    );
  }

  // public getFormattedSummaryTextExpanded(): string {
  //   const aFiltersWithValues = this.oFilterBar?.retrieveFiltersWithValues();

  //   if (aFiltersWithValues?.length === 0) {
  //     return "No filters active";
  //   }

  //   const sText = aFiltersWithValues?.length + " filters active ",
  //     aNonVisibleFiltersWithValues =
  //       this.oFilterBar?.retrieveNonVisibleFiltersWithValues();

  //   if (aFiltersWithValues?.length === 1) {
  //     sText = aFiltersWithValues.length + " filter active";
  //   }

  //   if (
  //     aNonVisibleFiltersWithValues &&
  //     aNonVisibleFiltersWithValues.length > 0
  //   ) {
  //     sText += " (" + aNonVisibleFiltersWithValues.length + " hidden)";
  //   }
  //   return sText;
  // }

  private _updateLabelsAndTable(): void {
    // this.oExpandedLabel?.setText(this.getFormattedSummaryTextExpanded());
    this.oSnappedLabel?.setText(this.getFormattedSummaryText());
    this.oTable?.setShowOverlay(true);
  }
}
