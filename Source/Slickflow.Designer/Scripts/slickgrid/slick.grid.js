//#region SlickGrid js
(function ($) {
    // Slick.Grid
    $.extend(true, window, {
        Slick: {
            Grid: SlickGrid
        }
    });

    // shared across all grids on the page
    var scrollbarDimensions;
    var maxSupportedCssHeight;  // browser's breaking point

    //////////////////////////////////////////////////////////////////////////////////////////////
    // SlickGrid class implementation (available as Slick.Grid)

    /**
     * Creates a new instance of the grid.
     * @class SlickGrid
     * @constructor
     * @param {Node}              container   Container node to create the grid in.
     * @param {Array,Object}      data        An array of objects for databinding.
     * @param {Array}             columns     An array of column definitions.
     * @param {Object}            options     Grid options.
     **/
    function SlickGrid(container, data, columns, options) {
        // settings
        var defaults = {
            explicitInitialization: false,
            rowHeight: 25,
            defaultColumnWidth: 80,
            enableAddRow: false,
            leaveSpaceForNewRows: false,
            editable: false,
            autoEdit: true,
            enableCellNavigation: true,
            enableColumnReorder: true,
            asyncEditorLoading: false,
            asyncEditorLoadDelay: 100,
            forceFitColumns: false,
            enableAsyncPostRender: false,
            asyncPostRenderDelay: 50,
            autoHeight: false,
            editorLock: Slick.GlobalEditorLock,
            showTopPanel: false,
            topPanelHeight: 25,
            formatterFactory: null,
            editorFactory: null,
            cellFlashingCssClass: "flashing",
            selectedCellCssClass: "selected",
            multiSelect: true,
            enableTextSelectionOnCells: false,
            dataItemColumnValueExtractor: null,
            frozenColumn: -1,
            fullWidthRows: false,
            multiColumnSort: false,
            defaultFormatter: defaultFormatter,
            forceSyncScrolling: false
        };

        var columnDefaults = {
            name: "",
            resizable: true,
            sortable: false,
            minWidth: 30,
            rerenderOnResize: false,
            headerCssClass: null,
            defaultSortAsc: true
        };

        // scroller
        var th;   // virtual height
        var h;    // real scrollable height
        var ph;   // page height
        var n;    // number of pages
        var cj;   // "jumpiness" coefficient

        var page = 0;       // current page
        var offset = 0;     // current page offset
        var vScrollDir = 1;

        // private
        var initialized = false;
        var $container;
        var uid, gridSytleSheetId, gridStyleSheetSet = [];
        var self = this;
        var $focusSink, $focusSink2;
        var $headerScroller;
        var $headers;
        var $topPanel;
        var $viewport;
        var $canvas;
        var $style;
        var $boundAncestors;
        var stylesheet, columnCssRules, columnCssRulesL, columnCssRulesR;
        var viewportH, viewportW;
        var canvasWidth, canvasWidthL, canvasWidthR;
        var headersWidth, headersWidthL, headersWidthR;
        var viewportHasHScroll, viewportHasVScroll;
        var headerColumnWidthDiff = 0,
            headerColumnHeightDiff = 0,
            // border+padding
            cellWidthDiff = 0,
            cellHeightDiff = 0;
        var absoluteColumnMinWidth;
        var numberOfRows = 0;
        var paneTopH = 0;
        var viewportTopH = 0;
        var topPanelH = 0;

        var tabbingDirection = 1;
        var $activeCanvasNode;
        var $activeViewportNode;
        var activePosX;
        var activeRow, activeCell;
        var activeCellNode = null;
        var currentEditor = null;
        var serializedEditorValue;
        var editController;

        var rowsCache = {};
        var renderedRows = 0;
        var numVisibleRows;
        var prevScrollTop = 0;
        var scrollTop = 0;
        var lastRenderedScrollTop = 0;
        var lastRenderedScrollLeft = 0;
        var prevScrollLeft = 0;
        var scrollLeft = 0;

        var selectionModel;
        var selectedRows = [];

        var plugins = [];
        var cellCssClasses = {};

        var columnsById = {};
        var sortColumns = [];
        var columnPosLeft = [];
        var columnPosRight = [];


        // async call handles
        var h_editorLoader = null;
        var h_render = null;
        var h_postrender = null;
        var postProcessedRows = {};
        var postProcessToRow = null;
        var postProcessFromRow = null;

        // perf counters
        var counter_rows_rendered = 0;
        var counter_rows_removed = 0;

        var $paneHeaderL;
        var $paneHeaderR;
        var $paneTopL;
        var $paneTopR;

        var $headerScrollerL;
        var $headerScrollerR;

        var $headerL;
        var $headerR;

        var $viewportTopL;
        var $viewportTopR;

        var $canvasTopL;
        var $canvasTopR;

        var $headerScrollContainer;
        var $viewportScrollContainerX;
        var $viewportScrollContainerY;
        //////////////////////////////////////////////////////////////////////////////////////////////
        // Initialization

        function init() {
            //var start = new Date().getTime();
            var visibleColumns = getVisibleColumns();
            columns = visibleColumns;

            $container = $(container);
            if ($container.length < 1) {
                throw new Error("SlickGrid requires a valid container, " + container + " does not exist in the DOM.");
            }

            // calculate these only once and share between grid instances
            maxSupportedCssHeight = maxSupportedCssHeight || getMaxSupportedCssHeight();
            scrollbarDimensions = scrollbarDimensions || measureScrollbar();

            options = $.extend({}, defaults, options);
            validateAndEnforceOptions();
            columnDefaults.width = options.defaultColumnWidth;

            columnsById = {};
            for (var i = 0; i < columns.length; i++) {
                var m = columns[i] = $.extend({}, columnDefaults, columns[i]);
                columnsById[m.id] = i;
                if (m.minWidth && m.width < m.minWidth) {
                    m.width = m.minWidth;
                }
                if (m.maxWidth && m.width > m.maxWidth) {
                    m.width = m.maxWidth;
                }
            }

            // validate loaded JavaScript modules against requested options
            if (options.enableColumnReorder && !$.fn.sortable) {
                throw new Error("SlickGrid's 'enableColumnReorder = true' option requires jquery-ui.sortable module to be loaded");
            }

            editController = {
                "commitCurrentEdit": commitCurrentEdit,
                "cancelCurrentEdit": cancelCurrentEdit
            };

            if (!uid) {
                var id = Math.round(28 * Math.random());
                gridSytleSheetId = 'gdcss78z90b' + id;
                uid = "slickgrid_" + Math.round(10000 * Math.random()) + id;
            }

            $container
                .empty()
                .css("overflow", "hidden")
                .css("outline", 0)
                .addClass(uid)
                .addClass("ui-widget");

            // set up a positioning container if needed
            if (!/relative|absolute|fixed/.test($container.css("position"))) {
                $container.css("position", "relative");
            }

            var index = Math.floor(Math.random() * 1000);
            var sinkId = "focusSink_" + index;
            var paneHeaderLId = "paneHeaderL_" + index;
            var paneHeaderRId = "paneHeaderR_" + index;
            var paneTopLId = "paneTopL_" + index;
            var paneTopRId = "paneTopR_" + index;
            var headerScrollerLId = "headerScrollerL_" + index;
            var headerScrollerRId = "headerScrollerR_" + index;
            var headerLId = "headerL_" + index;
            var headerRId = "headerR_" + index;
            var viewportTopLId = "viewportTopL_" + index;
            var viewportTopRId = "viewportTopR_" + index;
            var canvasTopLId = "canvasTopL_" + index;
            var canvasTopRId = "canvasTopR_" + index;

            var sinkHtml = "<div id='" + sinkId + "' tabIndex='0' hideFocus style='position:fixed;width:0;height:0;top:0;left:0;outline:0;'></div>"
                + "<div id='" + paneHeaderLId + "' class='slick-pane slick-pane-header slick-pane-left' tabIndex='0'>"
                    + "<div id='" + headerScrollerLId + "' class='ui-state-default slick-header slick-header-left'>"
                        + "<div id='" + headerLId + "' class='slick-header-columns slick-header-columns-left' style='left:-1000px' />"
                    + "</div>"
                + "</div>"
                + "<div id='" + paneHeaderRId + "' class='slick-pane slick-pane-header slick-pane-right' tabIndex='0'>"
                    + "<div id='" + headerScrollerRId + "' class='ui-state-default slick-header slick-header-right'>"
                         + "<div id='" + headerRId + "' class='slick-header-columns slick-header-columns-right' style='left:-1000px' />"
                    + "</div>"
                + "</div>"
                + "<div id='" + paneTopLId + "' class='slick-pane slick-pane-top slick-pane-left' tabIndex='0' >"
                    + "<div id='" + viewportTopLId + "' class='slick-viewport slick-viewport-top slick-viewport-left' tabIndex='0' hideFocus >"
                         + "<div id='" + canvasTopLId + "' class='grid-canvas grid-canvas-top grid-canvas-left' tabIndex='0' hideFocus />"
                    + "</div>"
                + "</div>"
                + "<div id='" + paneTopRId + "' class='slick-pane slick-pane-top slick-pane-right' tabIndex='0'>"
                    + "<div id='" + viewportTopRId + "' class='slick-viewport slick-viewport-top slick-viewport-right' tabIndex='0' hideFocus >"
                        + "<div id='" + canvasTopRId + "' class='grid-canvas grid-canvas-top grid-canvas-right' tabIndex='0' hideFocus />"
                    + "</div>"
                + "</div>";

            //Containers used for scrolling frozen columns
            $container.html(sinkHtml);

            $focusSink = $("#" + sinkId);
            $paneHeaderL = $("#" + paneHeaderLId);
            $paneHeaderR = $("#" + paneHeaderRId);
            $paneTopL = $("#" + paneTopLId);
            $paneTopR = $("#" + paneTopRId);
            $headerScrollerL = $("#" + headerScrollerLId);
            $headerScrollerR = $("#" + headerScrollerRId);
            $headerL = $("#" + headerLId);
            $headerR = $("#" + headerRId);
            $viewportTopL = $("#" + viewportTopLId);
            $viewportTopR = $("#" + viewportTopRId);
            $canvasTopL = $("#" + canvasTopLId);
            $canvasTopR = $("#" + canvasTopRId);

            // Cache the header scroller containers
            $headerScroller = $().add($headerScrollerL).add($headerScrollerR);

            // Cache the header columns
            $headers = $().add($headerL).add($headerR);

            // Cache the viewports
            $viewport = $().add($viewportTopL).add($viewportTopR);
            // Default the active viewport to the top left
            $activeViewportNode = $viewportTopL;

            // Cache the canvases
            $canvas = $().add($canvasTopL).add($canvasTopR);

            // Default the active canvas to the top left
            $activeCanvasNode = $canvasTopL;

            $focusSink2 = $focusSink.clone().appendTo($container);

            if (!options.explicitInitialization) {
                finishInitialization();
            }
        }

        function getVisibleColumns() {
            var visibleColumns = jQuery.grep(columns, function (x) {
                return (x && x.visible != false);
            });
            return visibleColumns;
        }

        function getGridId() {
            return uid;
        }

        function getHeaderColumnWidthDiff() {
            return headerColumnWidthDiff;
        }

        function finishInitialization() {
            if (!initialized) {
                initialized = true;

                getViewportWidth();
                getViewportHeight();

                // header columns and cells may have different padding/border
                // skewing width calculations (box-sizing, hello?)
                // calculate the diff so we can set consistent sizes
                measureCellPaddingAndBorder();

                // for usability reasons, all text selection in SlickGrid is
                // disabled with the exception of input and textarea elements (selection
                // must be enabled there so that editors work as expected); note that
                // selection in grid cells (grid body) is already unavailable in
                // all browsers except IE
                disableSelection($headers); // disable all text selection in header (including input and textarea)

                if (!options.enableTextSelectionOnCells) {
                    // disable text selection in grid cells except in input and textarea elements
                    // (this is IE-specific, because selectstart event will only fire in IE)
                    $viewport.bind("selectstart.ui", function (event) {
                        return $(event.target).is("input,textarea");
                    });
                }

                setFrozenOptions();
                setPaneVisibility();
                setScroller();
                setOverflow();

                updateColumnCaches();
                createColumnHeaders();      //slow
                setupColumnSort();
                createCssRules();

                resizeCanvas();         //slow
                bindAncestorScrollEvents();

                $container
                    .bind("resize.slickgrid", resizeCanvas);
                $viewport
                    .bind("scroll", handleScroll);
                if (jQuery.fn.mousewheel && (options.frozenColumn > -1)) {
                    $viewport
                       .bind("mousewheel", handleMouseWheel);
                }
                $headerScroller
                    .bind("contextmenu", handleHeaderContextMenu)
                    .bind("click", handleHeaderClick)
                    .delegate(".slick-header-column", "mouseenter", handleHeaderMouseEnter)
                    .delegate(".slick-header-column", "mouseleave", handleHeaderMouseLeave);
                $focusSink.add($focusSink2)
                    .bind("keydown", handleKeyDown);
                $canvas
                    .bind("keydown", handleKeyDown)
                    .bind("click", handleClick)
                    .bind("dblclick", handleDblClick)
                    .bind("contextmenu", handleContextMenu)
                    .bind("draginit", handleDragInit)
                    .bind("dragstart", { distance: 3 }, handleDragStart)
                    .bind("drag", handleDrag)
                    .bind("dragend", handleDragEnd)
                    .delegate(".slick-row", "mouseenter", handleRowMouseEnter)
                    .delegate(".slick-row", "mouseleave", handleRowMouseLeave)
                    .delegate(".slick-cell", "mouseenter", handleMouseEnter)
                    .delegate(".slick-cell", "mouseleave", handleMouseLeave);
            }
        }

        function registerPlugin(plugin) {
            plugins.unshift(plugin);
            plugin.init(self);
        }

        function unregisterPlugin(plugin) {
            for (var i = plugins.length; i >= 0; i--) {
                if (plugins[i] === plugin) {
                    if (plugins[i].destroy) {
                        plugins[i].destroy();
                    }
                    plugins.splice(i, 1);
                    break;
                }
            }
        }

        function setSelectionModel(model) {
            if (selectionModel) {
                selectionModel.onSelectedRangesChanged.unsubscribe(handleSelectedRangesChanged);
                if (selectionModel.destroy) {
                    selectionModel.destroy();
                }
            }

            selectionModel = model;
            if (selectionModel) {
                selectionModel.init(self);
                selectionModel.onSelectedRangesChanged.subscribe(handleSelectedRangesChanged);
            }
        }

        function getSelectionModel() {
            return selectionModel;
        }

        function getCanvasNode(cell) {
            if (cell && cell > options.frozenColumn) {
                return $canvas[1];
            } else {
                return $canvas[0];
            }
        }

        function getActiveCanvasNode(element) {
            setActiveCanvasNode(element);

            return $activeCanvasNode[0];
        }

        function getCanvases() {
            return $canvas;
        }

        function setActiveCanvasNode(element) {
            if (element) {
                $activeCanvasNode = $(element.target).closest('.grid-canvas');
            }
        }

        function getViewportNode() {
            return $viewport[0];
        }

        function getActiveViewportNode(element) {
            setActiveViewPortNode(element);

            return $activeViewportNode[0];
        }

        function setActiveViewportNode(element) {
            if (element) {
                $activeViewportNode = $(element.target).closest('.slick-viewport');
            }
        }

        function measureScrollbar() {
            var $c = $("<div style='position:absolute; top:-10000px; left:-10000px; width:100px; height:100px; overflow:scroll;'></div>").appendTo("body");
            var dim = {
                width: $c.width() - $c[0].clientWidth,
                height: $c.height() - $c[0].clientHeight
            };
            $c.remove();
            return dim;
        }

        function getHeadersWidth() {
            headersWidth = headersWidthL = headersWidthR = 0;

            for (var i = 0, ii = columns.length; i < ii; i++) {
                var width = columns[i].width;

                if ((options.frozenColumn) > -1 && (i > options.frozenColumn)) {
                    headersWidthR += width;
                } else {
                    headersWidthL += width;
                }
            }

            if (options.frozenColumn > -1) {
                headersWidthL = headersWidthL + 1000;

                headersWidthR = Math.max(headersWidthR, viewportW) + headersWidthL;
                headersWidthR += scrollbarDimensions.width;
            } else {
                headersWidthL += scrollbarDimensions.width;
                headersWidthL = Math.max(headersWidthL, viewportW) + 1000;
            }

            headersWidth = headersWidthL + headersWidthR;
            return headersWidth;
        }

        function getCanvasWidth() {
            var availableWidth = viewportHasVScroll ? viewportW - scrollbarDimensions.width : viewportW;

            var i = columns.length;

            canvasWidthL = canvasWidthR = 0;

            while (i--) {
                if ((options.frozenColumn > -1) && (i > options.frozenColumn)) {
                    canvasWidthR += columns[i].width;
                } else {
                    canvasWidthL += columns[i].width;
                }
            }

            var totalRowWidth = canvasWidthL + canvasWidthR;

            return options.fullWidthRows ? Math.max(totalRowWidth, availableWidth) : totalRowWidth;
        }

        function updateCanvasWidth(forceColumnWidthsUpdate) {
            var oldCanvasWidth = canvasWidth;
            var oldCanvasWidthL = canvasWidthL;
            var oldCanvasWidthR = canvasWidthR;
            var widthChanged;
            canvasWidth = getCanvasWidth();

            widthChanged = canvasWidth !== oldCanvasWidth || canvasWidthL !== oldCanvasWidthL || canvasWidthR !== oldCanvasWidthR;

            if (widthChanged || options.frozenColumn > -1) {
                $canvasTopL.width(canvasWidthL);

                getHeadersWidth();

                $headerL.width(headersWidthL);
                $headerR.width(headersWidthR);

                if (options.frozenColumn > -1) {
                    $canvasTopR.width(canvasWidthR);

                    $paneHeaderL.width(canvasWidthL);
                    $paneHeaderR.css('left', canvasWidthL);
                    $paneHeaderR.css('top', 0);

                    $paneTopL.width(canvasWidthL);
                    $paneTopR.css('left', canvasWidthL);

                    $viewportTopL.width(canvasWidthL);
                    $viewportTopR.width(viewportW - canvasWidthL);

                } else {
                    //$paneHeaderL.width('100%');
                    //$paneTopL.width('100%');
                    //$viewportTopL.width('100%');
                }

                viewportHasHScroll = (canvasWidth > viewportW - scrollbarDimensions.width);
            }

            if (widthChanged || forceColumnWidthsUpdate) {
                applyColumnWidths();
            }
        }

        function disableSelection($target) {
            if ($target && $target.jquery) {
                $target.attr("unselectable", "on").css("MozUserSelect", "none").bind("selectstart.ui", function () {
                    return false;
                }); // from jquery:ui.core.js 1.7.2
            }
        }

        function getMaxSupportedCssHeight() {
            var supportedHeight = 1000000;
            // FF reports the height back but still renders blank after ~6M px
            var testUpTo = (!Sys.ie) ? 6000000 : 1000000000;//$.browser.mozilla
            var div = $("<div style='display:none' />").appendTo(document.body);

            while (true) {
                var test = supportedHeight * 2;
                div.css("height", test);
                if (test > testUpTo || div.height() !== test) {
                    break;
                } else {
                    supportedHeight = test;
                }
            }

            div.remove();
            return supportedHeight;
        }

        // TODO:  this is static.  need to handle page mutation.
        function bindAncestorScrollEvents() {
            var elem = $canvasTopL[0];
            while ((elem = elem.parentNode) != document.body && elem != null) {
                // bind to scroll containers only
                if (elem == $viewportTopL[0] || elem.scrollWidth != elem.clientWidth || elem.scrollHeight != elem.clientHeight) {
                    var $elem = $(elem);
                    if (!$boundAncestors) {
                        $boundAncestors = $elem;
                    } else {
                        $boundAncestors = $boundAncestors.add($elem);
                    }
                    $elem.bind("scroll." + uid, handleActiveCellPositionChange);
                }
            }
        }

        function unbindAncestorScrollEvents() {
            if (!$boundAncestors) {
                return;
            }
            $boundAncestors.unbind("scroll." + uid);
            $boundAncestors = null;
        }

        function updateColumnHeader(columnId, title, toolTip) {
            if (!initialized) {
                return;
            }
            var idx = getColumnIndex(columnId);
            if (idx == null) {
                return;
            }

            var columnDef = columns[idx];
            var $header = $headers.children().eq(idx);
            if ($header) {
                if (title !== undefined) {
                    columns[idx].name = title;
                }
                if (toolTip !== undefined) {
                    columns[idx].toolTip = toolTip;
                }

                trigger(self.onBeforeHeaderCellDestroy, {
                    "node": $header[0],
                    "column": columnDef
                });

                $header.attr("title", toolTip || "").children().eq(0).html(title);

                trigger(self.onHeaderCellRendered, {
                    "node": $header[0],
                    "column": columnDef
                });
            }
        }

        function createColumnHeaders() {
            function hoverBegin() {
                $(this).addClass("ui-state-hover");
            }

            function hoverEnd() {
                $(this).removeClass("ui-state-hover");
            }

            $headers.find(".slick-header-column")
                .each(function () {
                    var columnDef = $(this).data("column");
                    if (columnDef) {
                        trigger(self.onBeforeHeaderCellDestroy, {
                            "node": this,
                            "column": columnDef
                        });
                    }
                });

            $headerL.empty();
            $headerR.empty();

            getHeadersWidth();

            $headerL.width(headersWidthL);
            $headerR.width(headersWidthR);

            var maxSpanHeight = 16;
            var divHeaderID;
            var divHeaderCSS = 'dHCss0x9liY86gong' + uid;

            for (var i = 0; i < columns.length; i++) {
                var m = columns[i];

                var $headerTarget = (options.frozenColumn > -1) ? ((i <= options.frozenColumn) ? $headerL : $headerR) : $headerL;

                divHeaderID = uid + m.id;

                var header = $("<div class='ui-state-default slick-header-column " + divHeaderCSS + "' id='" + divHeaderID + "' />")
                    .html("<span class='slick-column-name'>" + m.name + "</span>")
                    .width(m.width - headerColumnWidthDiff)
                    .attr("title", m.toolTip || "")
                    .data("column", m)
                    .addClass(m.headerCssClass || "")
                    .appendTo($headerTarget);

                var divHeader = $("#" + divHeaderID);
                var spanHeader = divHeader.children().first();  //get span in div

                if (spanHeader.height() > divHeader.height()
                    && spanHeader.height() > maxSpanHeight) {
                    maxSpanHeight = spanHeader.height();
                }

                if (options.enableColumnReorder || m.sortable) {
                    header.hover(hoverBegin, hoverEnd);
                }

                if (m.sortable) {
                    header.addClass("slick-header-sortable");
                    header.append("<span class='slick-sort-indicator' />");
                }

                trigger(self.onHeaderCellRendered, {
                    "node": header[0],
                    "column": m
                });
            }

            //setting header height
            $("div." + divHeaderCSS).css("height", maxSpanHeight);

            setSortColumns(sortColumns);
            setupColumnResize();
            if (options.enableColumnReorder) {
                setupColumnReorder();
            }
        }

        function setupColumnSort() {
            $headers.click(function (e) {
                // temporary workaround for a bug in jQuery 1.7.1
                // (http://bugs.jquery.com/ticket/11328)
                e.metaKey = e.metaKey || e.ctrlKey;

                if ($(e.target).hasClass("slick-resizable-handle")) {
                    return;
                }

                var $col = $(e.target).closest(".slick-header-column");
                if (!$col.length) {
                    return;
                }

                var column = $col.data("column");
                if (column.sortable) {
                    if (!getEditorLock().commitCurrentEdit()) {
                        return;
                    }

                    var sortOpts = null;
                    var i = 0;
                    for (; i < sortColumns.length; i++) {
                        if (sortColumns[i].columnId == column.id) {
                            sortOpts = sortColumns[i];
                            sortOpts.sortAsc = !sortOpts.sortAsc;
                            break;
                        }
                    }

                    if (e.metaKey && options.multiColumnSort) {
                        if (sortOpts) {
                            sortColumns.splice(i, 1);
                        }
                    } else {
                        if ((!e.shiftKey && !e.metaKey) || !options.multiColumnSort) {
                            sortColumns = [];
                        }

                        if (!sortOpts) {
                            sortOpts = {
                                columnId: column.id,
                                sortAsc: true
                            };
                            sortColumns.push(sortOpts);
                        } else if (sortColumns.length == 0) {
                            sortColumns.push(sortOpts);
                        }
                    }

                    setSortColumns(sortColumns);

                    if (!options.multiColumnSort) {
                        trigger(self.onSort, {
                            multiColumnSort: false,
                            sortCol: column,
                            sortAsc: sortOpts.sortAsc
                        }, e);
                    } else {
                        trigger(
                        self.onSort, {
                            multiColumnSort: true,
                            sortCols: $.map(
                            sortColumns, function (col) {
                                return {
                                    sortCol: columns[getColumnIndex(col.columnId)],
                                    sortAsc: col.sortAsc
                                };
                            })
                        }, e);
                    }
                }
            });
        }

        function setupColumnReorder() {
            $headers.filter(":ui-sortable").sortable("destroy");
            var columnScrollTimer = null;

            function scrollColumnsRight() {
                $viewportScrollContainerX[0].scrollLeft = $viewportScrollContainerX[0].scrollLeft + 10;
            }

            function scrollColumnsLeft() {
                $viewportScrollContainerX[0].scrollLeft = $viewportScrollContainerX[0].scrollLeft - 10;
            }

            $headers.sortable({
                containment: "parent",
                distance: 3,
                axis: "x",
                cursor: "default",
                tolerance: "intersection",
                helper: "clone",
                placeholder: "slick-sortable-placeholder ui-state-default slick-header-column",
                forcePlaceholderSize: true,
                start: function (e, ui) {
                    $(ui.helper).addClass("slick-header-column-active");
                },
                beforeStop: function (e, ui) {
                    $(ui.helper).removeClass("slick-header-column-active");
                },
                sort: function (e, ui) {
                    if (e.originalEvent.pageX > $container[0].clientWidth) {
                        //if (!(columnScrollTimer)) {
                        //    columnScrollTimer = setInterval(
                        //    scrollColumnsRight, 100);
                        //}
                    } else if (e.originalEvent.pageX < $viewportScrollContainerX.offset().left) {
                        //if (!(columnScrollTimer)) {
                        //    columnScrollTimer = setInterval(
                        //    scrollColumnsLeft, 100);
                        //}
                    } else {
                        clearInterval(columnScrollTimer);
                        columnScrollTimer = null;
                    }
                },
                stop: function (e) {
                    clearInterval(columnScrollTimer);
                    columnScrollTimer = null;

                    if (!getEditorLock().commitCurrentEdit()) {
                        $(this).sortable("cancel");
                        return;
                    }

                    var reorderedIds = $headerL.sortable("toArray");
                    reorderedIds = reorderedIds.concat($headerR.sortable("toArray"));

                    var reorderedColumns = [];
                    for (var i = 0; i < reorderedIds.length; i++) {
                        reorderedColumns.push(columns[getColumnIndex(reorderedIds[i].replace(uid, ""))]);
                    }
                    setColumns(reorderedColumns);

                    trigger(self.onColumnsReordered, {});
                    e.stopPropagation();
                    setupColumnResize();
                }
            });
        }

        function setupColumnResize() {
            var $col, j, c, pageX, columnElements, minPageX, maxPageX, firstResizable, lastResizable;
            columnElements = $headers.children();
            columnElements.find(".slick-resizable-handle").remove();
            columnElements.each(function (i, e) {
                if (columns[i].resizable) {
                    if (firstResizable === undefined) {
                        firstResizable = i;
                    }
                    lastResizable = i;
                }
            });
            if (firstResizable === undefined) {
                return;
            }
            columnElements.each(function (i, e) {
                if (i < firstResizable || (options.forceFitColumns && i >= lastResizable)) {
                    return;
                }
                $col = $(e);
                $("<div class='slick-resizable-handle' />")
                    .appendTo(e)
                    .bind("dragstart", function (e, dd) {
                        if (!getEditorLock().commitCurrentEdit()) {
                            return false;
                        }
                        pageX = e.pageX;
                        $(this).parent().addClass("slick-header-column-active");
                        var shrinkLeewayOnRight = null,
                            stretchLeewayOnRight = null;
                        // lock each column's width option to current width
                        columnElements.each(function (i, e) {
                            columns[i].previousWidth = $(e).outerWidth();
                        });
                        if (options.forceFitColumns) {
                            shrinkLeewayOnRight = 0;
                            stretchLeewayOnRight = 0;
                            // colums on right affect maxPageX/minPageX
                            for (j = i + 1; j < columnElements.length; j++) {
                                c = columns[j];
                                if (c.resizable) {
                                    if (stretchLeewayOnRight !== null) {
                                        if (c.maxWidth) {
                                            stretchLeewayOnRight += c.maxWidth - c.previousWidth;
                                        } else {
                                            stretchLeewayOnRight = null;
                                        }
                                    }
                                    shrinkLeewayOnRight += c.previousWidth - Math.max(c.minWidth || 0, absoluteColumnMinWidth);
                                }
                            }
                        }
                        var shrinkLeewayOnLeft = 0,
                            stretchLeewayOnLeft = 0;
                        for (j = 0; j <= i; j++) {
                            // columns on left only affect minPageX
                            c = columns[j];
                            if (c.resizable) {
                                if (stretchLeewayOnLeft !== null) {
                                    if (c.maxWidth) {
                                        stretchLeewayOnLeft += c.maxWidth - c.previousWidth;
                                    } else {
                                        stretchLeewayOnLeft = null;
                                    }
                                }
                                shrinkLeewayOnLeft += c.previousWidth - Math.max(c.minWidth || 0, absoluteColumnMinWidth);
                            }
                        }
                        if (shrinkLeewayOnRight === null) {
                            shrinkLeewayOnRight = 100000;
                        }
                        if (shrinkLeewayOnLeft === null) {
                            shrinkLeewayOnLeft = 100000;
                        }
                        if (stretchLeewayOnRight === null) {
                            stretchLeewayOnRight = 100000;
                        }
                        if (stretchLeewayOnLeft === null) {
                            stretchLeewayOnLeft = 100000;
                        }
                        maxPageX = pageX + Math.min(shrinkLeewayOnRight, stretchLeewayOnLeft);
                        minPageX = pageX - Math.min(shrinkLeewayOnLeft, stretchLeewayOnRight);
                    }).bind("drag", function (e, dd) {
                        var actualMinWidth, d = Math.min(maxPageX, Math.max(minPageX, e.pageX)) - pageX,
                            x;

                        if (d < 0) { // shrink column
                            x = d;

                            var newCanvasWidthL = 0, newCanvasWidthR = 0;

                            for (j = i; j >= 0; j--) {
                                c = columns[j];
                                if (c.resizable) {
                                    actualMinWidth = Math.max(c.minWidth || 0, absoluteColumnMinWidth);
                                    if (x && c.previousWidth + x < actualMinWidth) {
                                        x += c.previousWidth - actualMinWidth;
                                        c.width = actualMinWidth;
                                    } else {
                                        c.width = c.previousWidth + x;
                                        x = 0;
                                    }
                                }
                            }

                            for (k = 0; k <= i; k++) {
                                c = columns[k];

                                if ((options.frozenColumn > -1) && (k > options.frozenColumn)) {
                                    newCanvasWidthR += c.width;
                                } else {
                                    newCanvasWidthL += c.width;
                                }
                            }

                            if (options.forceFitColumns) {
                                x = -d;
                                for (j = i + 1; j < columnElements.length; j++) {
                                    c = columns[j];
                                    if (c.resizable) {
                                        if (x && c.maxWidth && (c.maxWidth - c.previousWidth < x)) {
                                            x -= c.maxWidth - c.previousWidth;
                                            c.width = c.maxWidth;
                                        } else {
                                            c.width = c.previousWidth + x;
                                            x = 0;
                                        }

                                        if ((options.frozenColumn > -1) && (j > options.frozenColumn)) {
                                            newCanvasWidthR += c.width;
                                        } else {
                                            newCanvasWidthL += c.width;
                                        }
                                    }
                                }
                            } else {
                                for (j = i + 1; j < columnElements.length; j++) {
                                    c = columns[j];

                                    if ((options.frozenColumn > -1) && (j > options.frozenColumn)) {
                                        newCanvasWidthR += c.width;
                                    } else {
                                        newCanvasWidthL += c.width;
                                    }
                                }
                            }
                        } else { // stretch column
                            x = d;

                            var newCanvasWidthL = 0, newCanvasWidthR = 0;

                            for (j = i; j >= 0; j--) {
                                c = columns[j];
                                if (c.resizable) {
                                    if (x && c.maxWidth && (c.maxWidth - c.previousWidth < x)) {
                                        x -= c.maxWidth - c.previousWidth;
                                        c.width = c.maxWidth;
                                    } else {
                                        c.width = c.previousWidth + x;
                                        x = 0;
                                    }
                                }
                            }

                            for (k = 0; k <= i; k++) {
                                c = columns[k];

                                if ((options.frozenColumn > -1) && (k > options.frozenColumn)) {
                                    newCanvasWidthR += c.width;
                                } else {
                                    newCanvasWidthL += c.width;
                                }
                            }

                            if (options.forceFitColumns) {
                                x = -d;
                                for (j = i + 1; j < columnElements.length; j++) {
                                    c = columns[j];
                                    if (c.resizable) {
                                        actualMinWidth = Math.max(c.minWidth || 0, absoluteColumnMinWidth);
                                        if (x && c.previousWidth + x < actualMinWidth) {
                                            x += c.previousWidth - actualMinWidth;
                                            c.width = actualMinWidth;
                                        } else {
                                            c.width = c.previousWidth + x;
                                            x = 0;
                                        }

                                        if ((options.frozenColumn > -1) && (j > options.frozenColumn)) {
                                            newCanvasWidthR += c.width;
                                        } else {
                                            newCanvasWidthL += c.width;
                                        }
                                    }
                                }
                            } else {
                                for (j = i + 1; j < columnElements.length; j++) {
                                    c = columns[j];

                                    if ((options.frozenColumn > -1) && (j > options.frozenColumn)) {
                                        newCanvasWidthR += c.width;
                                    } else {
                                        newCanvasWidthL += c.width;
                                    }
                                }
                            }
                        }

                        if (options.frozenColumn > -1 && newCanvasWidthL != canvasWidthL) {
                            $headerL.width(newCanvasWidthL + 1000);
                            $paneHeaderR.css('left', newCanvasWidthL);
                        }

                        applyColumnHeaderWidths();
                        if (options.syncColumnCellResize) {
                            updateCanvasWidth();
                            applyColumnWidths();
                        }
                    }).bind("dragend", function (e, dd) {
                        var newWidth, newWidthT, newJ;
                        $(this).parent().removeClass("slick-header-column-active");
                        for (j = 0; j < columnElements.length; j++) {
                            c = columns[j];
                            newWidth = $(columnElements[j]).outerWidth();

                            if (c.previousWidth !== newWidth) {
                                newWidthT = newWidth;
                                newJ = j;
                                if (c.rerenderOnResize) {
                                    invalidateAllRows();
                                }
                            }
                        }
                        updateCanvasWidth(true);
                        render();
                        trigger(self.onColumnsResized, { "column": newJ, "width": newWidthT });
                    });
            });
        }

        function getVBoxDelta($el) {
            var p = ["borderTopWidth", "borderBottomWidth", "paddingTop", "paddingBottom"];
            var delta = 0;
            $.each(p, function (n, val) {
                delta += parseFloat($el.css(val)) || 0;
            });
            return delta;
        }

        function setFrozenOptions() {
            options.frozenColumn = (options.frozenColumn >= 0
                                     && options.frozenColumn < columns.length
                                   )
                                   ? parseInt(options.frozenColumn)
                                   : -1;
        }

        function setPaneVisibility() {
            if (options.frozenColumn > -1) {
                $paneHeaderR.show();
                $paneTopR.show();
            } else {
                $paneHeaderR.hide();
                $paneTopR.hide();
            }
        }

        function setOverflow() {
            if (options.frozenColumn > -1) {
                $viewportTopL.css({ 'overflow-x': 'scroll', 'overflow-y': 'hidden' });
                $viewportTopR.css({ 'overflow-x': 'scroll', 'overflow-y': 'auto' });
            }
            else {
                $viewportTopL.css({ 'overflow-x': 'auto', 'overflow-y': 'auto' });
                $viewportTopR.css({ 'overflow-x': 'auto', 'overflow-y': 'auto' });
            }
        }

        function setScroller() {
            if (options.frozenColumn > -1) {
                $headerScrollContainer = $headerScrollerR;
                $viewportScrollContainerX = $viewportScrollContainerY = $viewportTopR;
            } else {
                $headerScrollContainer = $headerScrollerL;
                $viewportScrollContainerX = $viewportScrollContainerY = $viewportTopL;
            }
        }

        function measureCellPaddingAndBorder() {
            var el;
            var h = ["borderLeftWidth", "borderRightWidth", "paddingLeft", "paddingRight"];
            var v = ["borderTopWidth", "borderBottomWidth", "paddingTop", "paddingBottom"];

            el = $("<div class='ui-state-default slick-header-column' style='visibility:hidden'>-</div>").appendTo($headers);
            headerColumnWidthDiff = headerColumnHeightDiff = 0;
            $.each(h, function (n, val) {
                headerColumnWidthDiff += parseFloat(el.css(val)) || 0;
            });
            $.each(v, function (n, val) {
                headerColumnHeightDiff += parseFloat(el.css(val)) || 0;
            });
            el.remove();

            var r = $("<div class='slick-row' />").appendTo($canvas);
            el = $("<div class='slick-cell' id='' style='visibility:hidden'>-</div>").appendTo(r);
            cellWidthDiff = cellHeightDiff = 0;
            $.each(h, function (n, val) {
                cellWidthDiff += parseFloat(el.css(val)) || 0;
            });
            $.each(v, function (n, val) {
                cellHeightDiff += parseFloat(el.css(val)) || 0;
            });
            r.remove();

            absoluteColumnMinWidth = Math.max(headerColumnWidthDiff, cellWidthDiff);
        }

        function getStyleSheet() {
            var sheets = document.styleSheets;

            for (var i = 0; i < sheets.length; i++) {
                if (sheets[i].ownerNode.id && (sheets[i].ownerNode.id == gridSytleSheetId)) {
                    stylesheet = sheets[i];
                    $style = $("#" + gridSytleSheetId);
                    break;
                }
            }
        }

        function createCssRules() {
            getStyleSheet();

            if (!stylesheet) {
                //append first grid identity
                $style = $("<style id='" + gridSytleSheetId + "' type='text/css' rel='stylesheet' count='1' />").appendTo($("head"));
            } else {
                //append new grid identity
              
                var count = Number.tryParseInt($style.attr('count'));
                $style.attr('count', count + 1);
            }

            var rowHeight = (options.rowHeight - cellHeightDiff);
            var columnCssRules = [
                "." + uid + " .slick-header-column { left: 1000px; }",
                "." + uid + " .slick-top-panel { height:" + options.topPanelHeight + "px; }",
                "." + uid + " .slick-cell { height:" + rowHeight + "px; }",
                "." + uid + " .slick-row { height:" + options.rowHeight + "px; }"
            ];

            for (var i = 0; len = columns.length, i < len; i++) {
                columnCssRules.push("." + uid + " .l" + i + " { }");
                columnCssRules.push("." + uid + " .r" + i + " { }");
            }

            if ($style[0].styleSheet) { // IE
                $style[0].styleSheet.cssText += columnCssRules.join(" ");
            } else {
                $style[0].appendChild(document.createTextNode(columnCssRules.join(" ")));
            }
        }

        function grepColumnCssRules(rules) {
            var items = jQuery.grep(rules, function (x) {
                return x.selectorText.contains(uid);
            });
            return items;
        }

        function getColumnCssRules(idx) {
            getStyleSheet();

            if (!stylesheet) {
                throw new Error("Cannot find stylesheet.");
            }

            // find and cache column CSS rules
            columnCssRulesL = [];
            columnCssRulesR = [];
            //var cssRules = (stylesheet.cssRules || stylesheet.rules);
            var cssRules = grepColumnCssRules(stylesheet.cssRules);
            var matches, columnIdx;

            for (var i = 0; i < cssRules.length; i++) {
                var selector = cssRules[i].selectorText;
                if (matches = /\.l\d+/.exec(selector)) {
                    columnIdx = parseInt(matches[0].substr(2, matches[0].length - 2), 10);
                    columnCssRulesL[columnIdx] = cssRules[i];
                } else if (matches = /\.r\d+/.exec(selector)) {
                    columnIdx = parseInt(matches[0].substr(2, matches[0].length - 2), 10);
                    columnCssRulesR[columnIdx] = cssRules[i];
                }
            }

            return {
                "left": columnCssRulesL[idx],
                "right": columnCssRulesR[idx]
            };
        }

        function removeCssRules() {
            getStyleSheet();          
            var count = Number.tryParseInt($style.attr('count'));
            if (count == 1) {
                $style.remove();
                stylesheet = null;
            } else if (count > 1) {
                stylesheet.cssRules = jQuery.grep(stylesheet.cssRules, function (value) {
                    return (value.selectorText.contains(uid) == false);
                });

                $style.attr('count', count - 1);
            } else {
                throw new Error("no grid stylesheet exist.");
            }
        }

        function destroy() {
            getEditorLock().cancelCurrentEdit();

            trigger(self.onBeforeDestroy, {});

            var i = plugins.length;
            while (i--) {
                unregisterPlugin(plugins[i]);
            }

            if (options.enableColumnReorder) {
                $headers.filter(":ui-sortable").sortable("destroy");
            }

            //if (options.enableColumnReorder && $headers.sortable) {
            //    $headers.sortable("destroy");
            //}

            unbindAncestorScrollEvents();
            $container.unbind(".slickgrid");
            removeCssRules();

            $canvas.unbind("draginit dragstart dragend drag");
            $container.empty().removeClass(uid);
        }


        //////////////////////////////////////////////////////////////////////////////////////////////
        // General

        function trigger(evt, args, e) {
            e = e || new Slick.EventData();
            args = args || {};
            args.grid = self;
            return evt.notify(args, e, self);
        }

        function getEditorLock() {
            return options.editorLock;
        }

        function getEditController() {
            return editController;
        }

        function getColumnIndex(id) {
            return columnsById[id];
        }

        function autosizeColumns() {
            var i, c, widths = [],
                shrinkLeeway = 0,
                total = 0,
                prevTotal, availWidth = viewportHasVScroll ? viewportW - scrollbarDimensions.width : viewportW;

            for (i = 0; i < columns.length; i++) {
                c = columns[i];
                widths.push(c.width);
                total += c.width;
                if (c.resizable) {
                    shrinkLeeway += c.width - Math.max(c.minWidth, absoluteColumnMinWidth);
                }
            }

            // shrink
            prevTotal = total;
            while (total > availWidth && shrinkLeeway) {
                var shrinkProportion = (total - availWidth) / shrinkLeeway;
                for (i = 0; i < columns.length && total > availWidth; i++) {
                    c = columns[i];
                    var width = widths[i];
                    if (!c.resizable || width <= c.minWidth || width <= absoluteColumnMinWidth) {
                        continue;
                    }
                    var absMinWidth = Math.max(c.minWidth, absoluteColumnMinWidth);
                    var shrinkSize = Math.floor(shrinkProportion * (width - absMinWidth)) || 1;
                    shrinkSize = Math.min(shrinkSize, width - absMinWidth);
                    total -= shrinkSize;
                    shrinkLeeway -= shrinkSize;
                    widths[i] -= shrinkSize;
                }
                if (prevTotal == total) {  // avoid infinite loop
                    break;
                }
                prevTotal = total;
            }

            // grow
            prevTotal = total;
            while (total < availWidth) {
                var growProportion = availWidth / total;
                for (i = 0; i < columns.length && total < availWidth; i++) {
                    c = columns[i];
                    if (!c.resizable || c.maxWidth <= c.width) {
                        continue;
                    }
                    var growSize = Math.min(Math.floor(growProportion * c.width) - c.width, (c.maxWidth - c.width) || 1000000) || 1;
                    total += growSize;
                    widths[i] += growSize;
                }
                if (prevTotal == total) {  // avoid infinite loop
                    break;
                }
                prevTotal = total;
            }

            var reRender = false;
            for (i = 0; i < columns.length; i++) {
                if (columns[i].rerenderOnResize && columns[i].width != widths[i]) {
                    reRender = true;
                }
                columns[i].width = widths[i];
            }

            applyColumnHeaderWidths();
            updateCanvasWidth(true);
            if (reRender) {
                invalidateAllRows();
                render();
            }
        }

        function applyColumnHeaderWidths() {
            if (!initialized) {
                return;
            }
            var h;
            for (var i = 0, headers = $headers.children(), ii = headers.length; i < ii; i++) {
                h = $(headers[i]);
                if (h.width() !== columns[i].width - headerColumnWidthDiff) {
                    h.width(columns[i].width - headerColumnWidthDiff);
                }
            }

            updateColumnCaches();
        }

        function applyColumnWidths() {
            var x = 0,
                w, rule;
            for (var i = 0; i < columns.length; i++) {
                w = columns[i].width;

                rule = getColumnCssRules(i);
                rule.left.style.left = x + "px";
                rule.right.style.right = (((options.frozenColumn != -1 && i > options.frozenColumn) ? canvasWidthR : canvasWidthL) - x - w) + "px";

                // If this column is frozen, reset the css left value since the
                // column starts in a new viewport.
                if (options.frozenColumn == i) {
                    x = 0;
                } else {
                    x += columns[i].width;
                }
            }
        }

        function setSortColumn(columnId, ascending) {
            setSortColumns([{
                columnId: columnId,
                sortAsc: ascending
            }]);
        }

        function setSortColumns(cols) {
            sortColumns = cols;

            var headerColumnEls = $headers.children();
            headerColumnEls.removeClass("slick-header-column-sorted").find(".slick-sort-indicator").removeClass("slick-sort-indicator-asc slick-sort-indicator-desc");

            $.each(sortColumns, function (i, col) {
                if (col.sortAsc == null) {
                    col.sortAsc = true;
                }
                var columnIndex = getColumnIndex(col.columnId);
                if (columnIndex != null) {
                    headerColumnEls.eq(columnIndex).addClass("slick-header-column-sorted").find(".slick-sort-indicator").addClass(
                    col.sortAsc ? "slick-sort-indicator-asc" : "slick-sort-indicator-desc");
                }
            });
        }

        function getSortColumns() {
            return sortColumns;
        }

        function handleSelectedRangesChanged(e, ranges) {
            selectedRows = [];
            var hash = {};
            for (var i = 0; i < ranges.length; i++) {
                for (var j = ranges[i].fromRow; j <= ranges[i].toRow; j++) {
                    if (!hash[j]) {  // prevent duplicates
                        selectedRows.push(j);
                        hash[j] = {};
                    }
                    for (var k = ranges[i].fromCell; k <= ranges[i].toCell; k++) {
                        if (canCellBeSelected(j, k)) {
                            hash[j][columns[k].id] = options.selectedCellCssClass;
                        }
                    }
                }
            }

            setCellCssStyles(options.selectedCellCssClass, hash);

            trigger(self.onSelectedRowsChanged, {
                rows: getSelectedRows()
            }, e);
        }

        function getColumns() {
            return columns;
        }

        function updateColumnCaches() {
            // Pre-calculate cell boundaries.
            columnPosLeft = [];
            columnPosRight = [];
            var x = 0;
            for (var i = 0, ii = columns.length; i < ii; i++) {
                columnPosLeft[i] = x;
                columnPosRight[i] = x + columns[i].width;

                if (options.frozenColumn == i) {
                    x = 0;
                } else {
                    x += columns[i].width;
                }
            }
        }

        function setColumns(columnDefinitions) {
            columns = columnDefinitions;

            columnsById = {};
            for (var i = 0; i < columns.length; i++) {
                var m = columns[i] = $.extend({}, columnDefaults, columns[i]);
                columnsById[m.id] = i;
                if (m.minWidth && m.width < m.minWidth) {
                    m.width = m.minWidth;
                }
                if (m.maxWidth && m.width > m.maxWidth) {
                    m.width = m.maxWidth;
                }
            }

            updateColumnCaches();

            if (initialized) {
                setPaneVisibility();
                setOverflow();
                invalidateAllRows();
                createColumnHeaders();
                removeCssRules();
                createCssRules();
                resizeCanvas();
                updateCanvasWidth();
                applyColumnWidths();
                handleScroll();
            }
        }

        function getOptions() {
            return options;
        }

        function setOptions(args) {
            if (!getEditorLock().commitCurrentEdit()) {
                return;
            }

            makeActiveCellNormal();

            if (options.enableAddRow !== args.enableAddRow) {
                invalidateRow(getDataLength());
            }

            options = $.extend(options, args);
            validateAndEnforceOptions();

            //$viewport.css("overflow-y", options.autoHeight ? "hidden" : "auto");
            render();
        }

        function validateAndEnforceOptions() {
            if (options.autoHeight) {
                options.leaveSpaceForNewRows = false;
            }
        }

        function setData(newData, scrollToTop) {
            data = newData;
            invalidateAllRows();
            updateRowCount();
            if (scrollToTop) {
                scrollTo(0);
            }
        }

        function getData() {
            if (data && data.getItems)
                return data.getItems();
            else
                return data;
        }

        function getDataLength() {
            if (data && data.getLength) {
                return data.getLength();
            } else if (data) {
                return data.length;
            } else {
                return 0;
            }
        }

        function getDataItem(i) {
            if (data && data.getItem) {
                return data.getItem(i);
            } else if (data) {
                return data[i];
            } else {
                return null;
            }
        }

        // ////////////////////////////////////////////////////////////////////////////////////////////
        // Rendering / Scrolling

        function scrollTo(y) {
            y = Math.max(y, 0);
            y = Math.min(y, th - $viewportScrollContainerY.height() + ((viewportHasHScroll || options.frozenColumn > -1) ? scrollbarDimensions.height : 0));

            var oldOffset = offset;

            page = Math.min(n - 1, Math.floor(y / ph));
            offset = Math.round(page * cj);
            var newScrollTop = y - offset;

            if (offset != oldOffset) {
                var range = getVisibleRange(newScrollTop);
                cleanupRows(range);
                updateRowPositions();
            }

            if (prevScrollTop != newScrollTop) {
                vScrollDir = (prevScrollTop + oldOffset < newScrollTop + offset) ? 1 : -1;

                lastRenderedScrollTop = (scrollTop = prevScrollTop = newScrollTop);

                if (options.frozenColumn > -1) {
                    $viewportTopL[0].scrollTop = newScrollTop;
                }

                $viewportScrollContainerY[0].scrollTop = newScrollTop;

                trigger(self.onViewportChanged, {});
            }
        }

        function defaultFormatter(row, cell, value, columnDef, dataContext) {
            if (value == null) {
                return "";
            } else {
                return value.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            }
        }

        function getFormatter(row, column) {
            var rowMetadata = data.getItemMetadata && data.getItemMetadata(row);

            // look up by id, then index
            var columnOverrides = rowMetadata && rowMetadata.columns && (rowMetadata.columns[column.id] || rowMetadata.columns[getColumnIndex(column.id)]);

            return (columnOverrides && columnOverrides.formatter) || (rowMetadata && rowMetadata.formatter) || column.formatter || (options.formatterFactory && options.formatterFactory.getFormatter(column)) || options.defaultFormatter;
        }

        function getEditor(row, cell) {
            var column = columns[cell];
            var rowMetadata = data.getItemMetadata && data.getItemMetadata(row);
            var columnMetadata = rowMetadata && rowMetadata.columns;

            if (columnMetadata && columnMetadata[column.id] && columnMetadata[column.id].editor !== undefined) {
                return columnMetadata[column.id].editor;
            }
            if (columnMetadata && columnMetadata[cell] && columnMetadata[cell].editor !== undefined) {
                return columnMetadata[cell].editor;
            }

            return column.editor || (options.editorFactory && options.editorFactory.getEditor(column));
        }

        function getDataItemValueForColumn(item, columnDef) {
            if (options.dataItemColumnValueExtractor) {
                return options.dataItemColumnValueExtractor(item, columnDef);
            }
            return item[columnDef.field];
        }

        function appendRowHtml(stringArrayL, stringArrayR, row, range) {
            var d = getDataItem(row);
            var dataLoading = row < getDataLength() && !d;
            var rowCss = "slick-row" +
                (dataLoading ? " loading" : "") +
                (row === activeRow ? " active" : "") +
                (row % 2 == 1 ? " odd" : " even");

            var metadata = data.getItemMetadata && data.getItemMetadata(row);

            if (metadata && metadata.cssClasses) {
                rowCss += " " + metadata.cssClasses;
            }

            var rowHtml = "<div class='ui-widget-content " + rowCss + "' style='top:"
                            + (options.rowHeight * row - offset)
                            + "px'>";

            stringArrayL.push(rowHtml);

            if (options.frozenColumn > -1) {
                stringArrayR.push(rowHtml);
            }

            var colspan, m;
            for (var i = 0, ii = columns.length; i < ii; i++) {
                m = columns[i];
                colspan = 1;
                if (metadata && metadata.columns) {
                    var columnData = metadata.columns[m.id] || metadata.columns[i];
                    colspan = (columnData && columnData.colspan) || 1;
                    if (colspan === "*") {
                        colspan = ii - i;
                    }
                }

                // Do not render cells outside of the viewport.
                if (columnPosRight[Math.min(ii - 1, i + colspan - 1)] > range.leftPx) {
                    if (columnPosLeft[i] > range.rightPx) {
                        // All columns to the right are outside the range.
                        break;
                    }

                    if ((options.frozenColumn > -1) && (i > options.frozenColumn)) {
                        appendCellHtml(stringArrayR, row, i, colspan);
                    } else {
                        appendCellHtml(stringArrayL, row, i, colspan);
                    }
                } else if ((options.frozenColumn > -1) && (i <= options.frozenColumn)) {
                    appendCellHtml(stringArrayL, row, i, colspan);
                }

                if (colspan > 1) {
                    i += (colspan - 1);
                }
            }

            stringArrayL.push("</div>");

            if (options.frozenColumn > -1) {
                stringArrayR.push("</div>");
            }
        }

        function appendCellHtml(stringArray, row, cell, colspan) {
            var m = columns[cell];
            var d = getDataItem(row);
            var cellCss = "slick-cell l" + cell + " r" + Math.min(columns.length - 1, cell + colspan - 1)
                        + (m.cssClass ? " " + m.cssClass : "");
            if (row === activeRow && cell === activeCell) {
                cellCss += (" active");
            }

            // TODO:  merge them together in the setter
            for (var key in cellCssClasses) {
                if (cellCssClasses[key][row] && cellCssClasses[key][row][m.id]) {
                    cellCss += (" " + cellCssClasses[key][row][m.id]);
                }
            }

            stringArray.push("<div class='" + cellCss + "'>");

            // if there is a corresponding row (if not, this is the Add New row or this data hasn't been loaded yet)
            if (d) {
                var value = getDataItemValueForColumn(d, m);
                stringArray.push(getFormatter(row, m)(row, cell, value, m, d));
            }

            stringArray.push("</div>");

            rowsCache[row].cellRenderQueue.push(cell);
            rowsCache[row].cellColSpans[cell] = colspan;
        }


        function cleanupRows(rangeToKeep) {
            for (var i in rowsCache) {
                var removeFrozenRow = true;

                if (((i = parseInt(i, 10)) !== activeRow)
                     && (i < rangeToKeep.top || i > rangeToKeep.bottom)
                     && (removeFrozenRow)
                   ) {
                    removeRowFromCache(i);
                }
            }
        }

        function invalidate() {
            updateRowCount();
            invalidateAllRows();
            render();
        }

        function invalidateAllRows() {
            if (currentEditor) {
                makeActiveCellNormal();
            }
            for (var row in rowsCache) {
                removeRowFromCache(row);
            }
        }

        function removeRowFromCache(row) {
            var cacheEntry = rowsCache[row];
            if (!cacheEntry) {
                return;
            }

            cacheEntry.rowNode[0].parentElement.removeChild(cacheEntry.rowNode[0]);

            // Remove the row from the right viewport
            if (cacheEntry.rowNode[1]) {
                cacheEntry.rowNode[1].parentElement.removeChild(cacheEntry.rowNode[1]);
            }

            delete rowsCache[row];
            delete postProcessedRows[row];
            renderedRows--;
            counter_rows_removed++;
        }

        function invalidateRows(rows) {
            var i, rl;
            if (!rows || !rows.length) {
                return;
            }
            vScrollDir = 0;
            for (i = 0, rl = rows.length; i < rl; i++) {
                if (currentEditor && activeRow === rows[i]) {
                    makeActiveCellNormal();
                }
                if (rowsCache[rows[i]]) {
                    removeRowFromCache(rows[i]);
                }
            }
        }

        function invalidateRow(row) {
            invalidateRows([row]);
        }

        function updateCell(row, cell) {
            var cellNode = getCellNode(row, cell);
            if (!cellNode) {
                return;
            }

            var m = columns[cell],
                d = getDataItem(row);
            if (currentEditor && activeRow === row && activeCell === cell) {
                currentEditor.loadValue(d);
            } else {
                cellNode.innerHTML = d ? getFormatter(row, m)(row, cell, getDataItemValueForColumn(d, m), m, d) : "";
                invalidatePostProcessingResults(row);
            }
        }

        function updateRow(row) {
            var cacheEntry = rowsCache[row];
            if (!cacheEntry) {
                return;
            }

            ensureCellNodesInRowsCache(row);

            for (var columnIdx in cacheEntry.cellNodesByColumnIdx) {
                if (!cacheEntry.cellNodesByColumnIdx.hasOwnProperty(columnIdx)) {
                    continue;
                }

                columnIdx = columnIdx | 0;
                var m = columns[columnIdx],
                    d = getDataItem(row),
                    node = cacheEntry.cellNodesByColumnIdx[columnIdx][0];

                if (row === activeRow && columnIdx === activeCell && currentEditor) {
                    currentEditor.loadValue(d);
                } else if (d) {
                    node.innerHTML = getFormatter(row, m)(row, columnIdx, getDataItemValueForColumn(d, m), m, d);
                } else {
                    node.innerHTML = "";
                }
            }

            invalidatePostProcessingResults(row);
        }

        function getViewportHeight() {
            if (options.autoHeight) {
                viewportH = options.rowHeight
                          * (getDataLength()
                              + (options.enableAddRow ? 1 : 0)
                            )
                          + ((options.frozenColumn == -1) ? $headers.outerHeight() : 0);
            } else {

                viewportH = parseFloat($.css($container[0], "height", true))
                          - parseFloat($.css($container[0], "paddingTop", true))
                          - parseFloat($.css($container[0], "paddingBottom", true))
                          - parseFloat($.css($headerScroller[0], "height"))
                          - getVBoxDelta($headerScroller)
                          - topPanelH;
            }

            numVisibleRows = Math.ceil(viewportH / options.rowHeight);
        }

        function getViewportWidth() {
            viewportW = parseFloat($.css($container[0], "width", true));
        }

        function resizeCanvas() {
            if (!initialized) {
                return;
            }

            paneTopH = 0
            viewportTopH = 0

            getViewportWidth();
            getViewportHeight();

            paneTopH = viewportH;

            // The top pane includes the top panel and the header row
            paneTopH += topPanelH;

            if (options.frozenColumn > -1 && options.autoHeight) {
                paneTopH += scrollbarDimensions.height;
            }

            // The top viewport does not contain the top panel or header row
            viewportTopH = paneTopH - topPanelH;

            if (options.autoHeight) {
                if (options.frozenColumn > -1) {
                    $container.height(
                        paneTopH
                        + parseFloat($.css($headerScrollerL[0], "height"))
                    );
                }

                $paneTopL.css('position', 'relative');
            }

            $paneTopL.css({
                'top': $paneHeaderL.height()
                , 'height': paneTopH
            });

            var paneBottomTop = $paneTopL.position().top
                                + paneTopH;

            $viewportTopL.height(viewportTopH);

            if (options.frozenColumn > -1) {
                $paneTopR.css({
                    'top': $paneHeaderL.height()
                   , 'height': paneTopH
                });

                $viewportTopR.height(viewportTopH);

            }

            $viewportTopR.height(viewportTopH);


            if (options.forceFitColumns) {
                autosizeColumns();
            }

            updateRowCount();
            handleScroll();
            // Since the width has changed, force the render() to reevaluate virtually rendered cells.
            lastRenderedScrollLeft = -1;
            render();
        }

        function updateRowCount() {
            if (!initialized) {
                return;
            }

            var oldH = $canvasTopL.height();

            numberOfRows = getDataLength() + (options.enableAddRow ? 1 : 0) + (options.leaveSpaceForNewRows ? numVisibleRows - 1 : 0);


            var tempViewportH = $viewportScrollContainerY.height();
            var oldViewportHasVScroll = viewportHasVScroll;
            // with autoHeight, we do not need to accommodate the vertical scroll bar
            viewportHasVScroll = !options.autoHeight && (numberOfRows * options.rowHeight > tempViewportH);

            // remove the rows that are now outside of the data range
            // this helps avoid redundant calls to .removeRow() when the size of
            // the data decreased by thousands of rows
            var l = options.enableAddRow ? getDataLength() : getDataLength() - 1;
            for (var i in rowsCache) {
                if (i >= l) {
                    removeRowFromCache(i);
                }
            }

            th = Math.max(options.rowHeight * numberOfRows, tempViewportH - scrollbarDimensions.height);

            if (activeCellNode && activeRow > l) {
                resetActiveCell();
            }

            if (th < maxSupportedCssHeight) {
                // just one page
                h = ph = th;
                n = 1;
                cj = 0;
            } else {
                // break into pages
                h = maxSupportedCssHeight;
                ph = h / 100;
                n = Math.floor(th / ph);
                cj = (th - h) / (n - 1);
            }

            if (h !== oldH) {
                $canvasTopL.css("height", h);
                $canvasTopR.css("height", h);

                scrollTop = $viewportScrollContainerY[0].scrollTop;
            }

            var oldScrollTopInRange = (scrollTop + offset <= th - tempViewportH);

            if (th == 0 || scrollTop == 0) {
                page = offset = 0;
            } else if (oldScrollTopInRange) {
                // maintain virtual position
                scrollTo(scrollTop + offset);
            } else {
                // scroll to bottom
                scrollTo(th - tempViewportH);
            }

            if (h != oldH && options.autoHeight) {
                resizeCanvas();
            }

            if (options.forceFitColumns && oldViewportHasVScroll != viewportHasVScroll) {
                autosizeColumns();
            }
            updateCanvasWidth(false);
        }

        function getVisibleRange(viewportTop, viewportLeft) {
            if (viewportTop == null) {
                viewportTop = scrollTop;
            }
            if (viewportLeft == null) {
                viewportLeft = scrollLeft;
            }

            return {
                top: Math.floor((viewportTop + offset) / options.rowHeight),
                bottom: Math.ceil((viewportTop + offset + viewportH) / options.rowHeight),
                leftPx: viewportLeft,
                rightPx: viewportLeft + viewportW
            };
        }

        function getRenderedRange(viewportTop, viewportLeft) {
            var range = getVisibleRange(viewportTop, viewportLeft);
            var buffer = Math.round(viewportH / options.rowHeight);
            var minBuffer = 3;

            if (vScrollDir == -1) {
                range.top -= buffer;
                range.bottom += minBuffer;
            } else if (vScrollDir == 1) {
                range.top -= minBuffer;
                range.bottom += buffer;
            } else {
                range.top -= minBuffer;
                range.bottom += minBuffer;
            }

            range.top = Math.max(0, range.top);
            range.bottom = Math.min(options.enableAddRow ? getDataLength() : getDataLength() - 1, range.bottom);

            range.leftPx -= viewportW;
            range.rightPx += viewportW;

            range.leftPx = Math.max(0, range.leftPx);
            range.rightPx = Math.min(canvasWidth, range.rightPx);

            return range;
        }

        function ensureCellNodesInRowsCache(row) {
            var cacheEntry = rowsCache[row];
            if (cacheEntry) {
                if (cacheEntry.cellRenderQueue.length) {
                    var $lastNode = cacheEntry.rowNode.children().last();
                    while (cacheEntry.cellRenderQueue.length) {
                        var columnIdx = cacheEntry.cellRenderQueue.pop();

                        cacheEntry.cellNodesByColumnIdx[columnIdx] = $lastNode;
                        $lastNode = $lastNode.prev();

                        // Hack to retrieve the frozen columns because
                        if ($lastNode.length == 0) {
                            $lastNode = $(cacheEntry.rowNode[0]).children().last();
                        }
                    }
                }
            }
        }

        function cleanUpCells(range, row) {
            // Ignore frozen rows
            var totalCellsRemoved = 0;
            var cacheEntry = rowsCache[row];

            // Remove cells outside the range.
            var cellsToRemove = [];
            for (var i in cacheEntry.cellNodesByColumnIdx) {
                // I really hate it when people mess with Array.prototype.
                if (!cacheEntry.cellNodesByColumnIdx.hasOwnProperty(i)) {
                    continue;
                }

                // This is a string, so it needs to be cast back to a number.
                i = i | 0;

                // Ignore frozen columns
                if (i <= options.frozenColumn) {
                    continue;
                }

                var colspan = cacheEntry.cellColSpans[i];
                if (columnPosLeft[i] > range.rightPx || columnPosRight[Math.min(columns.length - 1, i + colspan - 1)] < range.leftPx) {
                    if (!(row == activeRow && i == activeCell)) {
                        cellsToRemove.push(i);
                    }
                }
            }

            var cellToRemove;
            while ((cellToRemove = cellsToRemove.pop()) != null) {
                cacheEntry.cellNodesByColumnIdx[cellToRemove][0].parentElement.removeChild(cacheEntry.cellNodesByColumnIdx[cellToRemove][0]);
                delete cacheEntry.cellColSpans[cellToRemove];
                delete cacheEntry.cellNodesByColumnIdx[cellToRemove];
                if (postProcessedRows[row]) {
                    delete postProcessedRows[row][cellToRemove];
                }
                totalCellsRemoved++;
            }
        }

        function cleanUpAndRenderCells(range) {
            var cacheEntry;
            var stringArray = [];
            var processedRows = [];
            var cellsAdded;
            var totalCellsAdded = 0;
            var colspan;

            for (var row = range.top; row <= range.bottom; row++) {
                cacheEntry = rowsCache[row];
                if (!cacheEntry) {
                    continue;
                }

                // cellRenderQueue populated in renderRows() needs to be cleared first
                ensureCellNodesInRowsCache(row);

                cleanUpCells(range, row);

                // Render missing cells.
                cellsAdded = 0;

                var metadata = data.getItemMetadata && data.getItemMetadata(row);
                metadata = metadata && metadata.columns;

                // TODO:  shorten this loop (index? heuristics? binary search?)
                for (var i = 0, ii = columns.length; i < ii; i++) {
                    // Cells to the right are outside the range.
                    if (columnPosLeft[i] > range.rightPx) {
                        break;
                    }

                    // Already rendered.
                    if ((colspan = cacheEntry.cellColSpans[i]) != null) {
                        i += (colspan > 1 ? colspan - 1 : 0);
                        continue;
                    }

                    colspan = 1;
                    if (metadata) {
                        var columnData = metadata[columns[i].id] || metadata[i];
                        colspan = (columnData && columnData.colspan) || 1;
                        if (colspan === "*") {
                            colspan = ii - i;
                        }
                    }

                    if (columnPosRight[Math.min(ii - 1, i + colspan - 1)] > range.leftPx) {
                        appendCellHtml(stringArray, row, i, colspan);
                        cellsAdded++;
                    }

                    i += (colspan > 1 ? colspan - 1 : 0);
                }

                if (cellsAdded) {
                    totalCellsAdded += cellsAdded;
                    processedRows.push(row);
                }
            }

            if (!stringArray.length) {
                return;
            }

            var x = document.createElement("div");
            x.innerHTML = stringArray.join("");

            var processedRow;
            var $node;
            while ((processedRow = processedRows.pop()) != null) {
                cacheEntry = rowsCache[processedRow];
                var columnIdx;
                while ((columnIdx = cacheEntry.cellRenderQueue.pop()) != null) {
                    $node = $(x).children().last();

                    if ((options.frozenColumn > -1) && (columnIdx > options.frozenColumn)) {
                        $(cacheEntry.rowNode[1]).append($node);
                    } else {
                        $(cacheEntry.rowNode[0]).append($node);
                    }

                    cacheEntry.cellNodesByColumnIdx[columnIdx] = $node;
                }
            }
        }

        function renderRows(range) {
            var stringArrayL = [],
                stringArrayR = [],
                rows = [],
                needToReselectCell = false;

            for (var i = range.top; i <= range.bottom; i++) {
                if (rowsCache[i]) {
                    continue;
                }
                renderedRows++;
                rows.push(i);

                // Create an entry right away so that appendRowHtml() can
                // start populatating it.
                rowsCache[i] = {
                    "rowNode": null,

                    // ColSpans of rendered cells (by column idx).
                    // Can also be used for checking whether a cell has been rendered.
                    "cellColSpans": [],

                    // Cell nodes (by column idx).  Lazy-populated by ensureCellNodesInRowsCache().
                    "cellNodesByColumnIdx": [],

                    // Column indices of cell nodes that have been rendered, but not yet indexed in
                    // cellNodesByColumnIdx.  These are in the same order as cell nodes added at the
                    // end of the row.
                    "cellRenderQueue": []
                };

                appendRowHtml(stringArrayL, stringArrayR, i, range);
                if (activeCellNode && activeRow === i) {
                    needToReselectCell = true;
                }
                counter_rows_rendered++;
            }

            if (!rows.length) {
                return;
            }

            var x = document.createElement("div"),
                xRight = document.createElement("div");

            x.innerHTML = stringArrayL.join("");
            xRight.innerHTML = stringArrayR.join("");

            for (var i = 0, ii = rows.length; i < ii; i++) {
                if (options.frozenColumn > -1) {
                    rowsCache[rows[i]].rowNode = $()
                        .add($(x.firstChild).appendTo($canvasTopL))
                        .add($(xRight.firstChild).appendTo($canvasTopR));
                } else {
                    rowsCache[rows[i]].rowNode = $()
                        .add($(x.firstChild).appendTo($canvasTopL));
                }
            }

            if (needToReselectCell) {
                activeCellNode = getCellNode(activeRow, activeCell);
            }
        }

        function startPostProcessing() {
            if (!options.enableAsyncPostRender) {
                return;
            }
            clearTimeout(h_postrender);
            h_postrender = setTimeout(asyncPostProcessRows, options.asyncPostRenderDelay);
        }

        function invalidatePostProcessingResults(row) {
            delete postProcessedRows[row];
            postProcessFromRow = Math.min(postProcessFromRow, row);
            postProcessToRow = Math.max(postProcessToRow, row);
            startPostProcessing();
        }

        function updateRowPositions() {
            for (var row in rowsCache) {
                rowsCache[row].rowNode.css('top', (row * options.rowHeight - offset) + "px");
            }
        }

        function render() {
            if (!initialized) {
                return;
            }
            var visible = getVisibleRange();
            var rendered = getRenderedRange();

            // remove rows no longer in the viewport
            cleanupRows(rendered);

            // add new rows & missing cells in existing rows
            if (lastRenderedScrollLeft != scrollLeft) {
                cleanUpAndRenderCells(rendered);
            }

            // render missing rows
            renderRows(rendered);

            postProcessFromRow = visible.top;
            postProcessToRow = Math.min(options.enableAddRow ? getDataLength() : getDataLength() - 1, visible.bottom);
            startPostProcessing();

            lastRenderedScrollTop = scrollTop;
            lastRenderedScrollLeft = scrollLeft;
            h_render = null;
        }

        function handleMouseWheel(event, delta, deltaX, deltaY) {
            scrollTop = $viewportScrollContainerY[0].scrollTop - (deltaY * options.rowHeight);
            scrollLeft = $viewportScrollContainerX[0].scrollLeft + (deltaX * 10);
            _handleScroll();
            event.preventDefault();
        }

        function handleScroll() {
            scrollTop = $viewportScrollContainerY[0].scrollTop;
            scrollLeft = $viewportScrollContainerX[0].scrollLeft;

            _handleScroll();
        }

        function _handleScroll() {
            var maxScrollDistanceY = $viewportScrollContainerY[0].scrollHeight - $viewportScrollContainerY[0].clientHeight;
            var maxScrollDistanceX = $viewportScrollContainerY[0].scrollWidth - $viewportScrollContainerY[0].clientWidth;

            // Ceiling the max scroll values
            if (scrollTop > maxScrollDistanceY) {
                scrollTop = maxScrollDistanceY;
            }
            if (scrollLeft > maxScrollDistanceX) {
                scrollLeft = maxScrollDistanceX;
            }

            var vScrollDist = Math.abs(scrollTop - prevScrollTop);
            var hScrollDist = Math.abs(scrollLeft - prevScrollLeft);

            if (hScrollDist) {
                prevScrollLeft = scrollLeft;
                $headerScrollContainer[0].scrollLeft = scrollLeft;
                $viewportScrollContainerX[0].scrollLeft = scrollLeft;
            }

            if (vScrollDist) {
                vScrollDir = prevScrollTop < scrollTop ? 1 : -1;
                prevScrollTop = scrollTop

                $viewportScrollContainerY[0].scrollTop = scrollTop;
                if (options.frozenColumn > -1) {
                    $viewportTopL[0].scrollTop = scrollTop;
                }

                // switch virtual pages if needed
                if (vScrollDist < viewportH) {
                    scrollTo(scrollTop + offset);
                } else {
                    var oldOffset = offset;
                    if (h == viewportH) {
                        page = 0;
                    } else {
                        page = Math.min(n - 1, Math.floor(scrollTop * ((th - viewportH) / (h - viewportH)) * (1 / ph)));
                    }
                    offset = Math.round(page * cj);
                    if (oldOffset != offset) {
                        invalidateAllRows();
                    }
                }
            }

            if (hScrollDist || vScrollDist) {
                if (h_render) {
                    clearTimeout(h_render);
                }

                if (Math.abs(lastRenderedScrollTop - scrollTop) > 20 ||
                    Math.abs(lastRenderedScrollLeft - scrollLeft) > 20) {
                    if (options.forceSyncScrolling || (
                        Math.abs(lastRenderedScrollTop - scrollTop) < viewportH &&
                        Math.abs(lastRenderedScrollLeft - scrollLeft) < viewportW)) {
                        render();
                    } else {
                        h_render = setTimeout(render, 50);
                    }

                    trigger(self.onViewportChanged, {});
                }
            }

            trigger(self.onScroll, {
                scrollLeft: scrollLeft,
                scrollTop: scrollTop
            });
        }

        function asyncPostProcessRows() {
            while (postProcessFromRow <= postProcessToRow) {
                var row = (vScrollDir >= 0) ? postProcessFromRow++ : postProcessToRow--;
                var cacheEntry = rowsCache[row];
                if (!cacheEntry || row >= getDataLength()) {
                    continue;
                }

                if (!postProcessedRows[row]) {
                    postProcessedRows[row] = {};
                }

                ensureCellNodesInRowsCache(row);
                for (var columnIdx in cacheEntry.cellNodesByColumnIdx) {
                    if (!cacheEntry.cellNodesByColumnIdx.hasOwnProperty(columnIdx)) {
                        continue;
                    }

                    columnIdx = columnIdx | 0;

                    var m = columns[columnIdx];
                    if (m.asyncPostRender && !postProcessedRows[row][columnIdx]) {
                        var node = cacheEntry.cellNodesByColumnIdx[columnIdx];
                        if (node) {
                            m.asyncPostRender(node, row, getDataItem(row), m);
                        }
                        postProcessedRows[row][columnIdx] = true;
                    }
                }

                h_postrender = setTimeout(asyncPostProcessRows, options.asyncPostRenderDelay);
                return;
            }
        }

        function updateCellCssStylesOnRenderedRows(addedHash, removedHash) {
            var node, columnId, addedRowHash, removedRowHash;
            for (var row in rowsCache) {
                removedRowHash = removedHash && removedHash[row];
                addedRowHash = addedHash && addedHash[row];

                if (removedRowHash) {
                    for (columnId in removedRowHash) {
                        if (!addedRowHash || removedRowHash[columnId] != addedRowHash[columnId]) {
                            node = getCellNode(row, getColumnIndex(columnId));
                            if (node) {
                                $(node).removeClass(removedRowHash[columnId]);
                            }
                        }
                    }
                }

                if (addedRowHash) {
                    for (columnId in addedRowHash) {
                        if (!removedRowHash || removedRowHash[columnId] != addedRowHash[columnId]) {
                            node = getCellNode(row, getColumnIndex(columnId));
                            if (node) {
                                $(node).addClass(addedRowHash[columnId]);
                            }
                        }
                    }
                }
            }
        }

        function addCellCssStyles(key, hash) {
            if (cellCssClasses[key]) {
                throw "addCellCssStyles: cell CSS hash with key '" + key + "' already exists.";
            }

            cellCssClasses[key] = hash;
            updateCellCssStylesOnRenderedRows(hash, null);

            trigger(self.onCellCssStylesChanged, {
                "key": key,
                "hash": hash
            });
        }

        function removeCellCssStyles(key) {
            if (!cellCssClasses[key]) {
                return;
            }

            updateCellCssStylesOnRenderedRows(null, cellCssClasses[key]);
            delete cellCssClasses[key];

            trigger(self.onCellCssStylesChanged, {
                "key": key,
                "hash": null
            });
        }

        function setCellCssStyles(key, hash) {
            var prevHash = cellCssClasses[key];

            cellCssClasses[key] = hash;
            updateCellCssStylesOnRenderedRows(hash, prevHash);

            trigger(self.onCellCssStylesChanged, {
                "key": key,
                "hash": hash
            });
        }

        function getCellCssStyles(key) {
            return cellCssClasses[key];
        }

        function flashCell(row, cell, speed) {
            speed = speed || 100;
            if (rowsCache[row]) {
                var $cell = $(getCellNode(row, cell));

                function toggleCellClass(times) {
                    if (!times) {
                        return;
                    }
                    setTimeout(function () {
                        $cell.queue(function () {
                            $cell.toggleClass(options.cellFlashingCssClass).dequeue();
                            toggleCellClass(times - 1);
                        });
                    }, speed);
                }

                toggleCellClass(4);
            }
        }

        //////////////////////////////////////////////////////////////////////////////////////////////
        // Interactivity

        function handleDragInit(e, dd) {
            var cell = getCellFromEvent(e);
            if (!cell || !cellExists(cell.row, cell.cell)) {
                return false;
            }

            retval = trigger(self.onDragInit, dd, e);
            if (e.isImmediatePropagationStopped()) {
                return retval;
            }

            // if nobody claims to be handling drag'n'drop by stopping immediate
            // propagation, cancel out of it
            return false;
        }

        function handleDragStart(e, dd) {
            var cell = getCellFromEvent(e);
            if (!cell || !cellExists(cell.row, cell.cell)) {
                return false;
            }

            var retval = trigger(self.onDragStart, dd, e);
            if (e.isImmediatePropagationStopped()) {
                return retval;
            }

            return false;
        }

        function handleDrag(e, dd) {
            return trigger(self.onDrag, dd, e);
        }

        function handleDragEnd(e, dd) {
            trigger(self.onDragEnd, dd, e);
        }

        function handleKeyDown(e) {
            trigger(self.onKeyDown, {
                row: activeRow,
                cell: activeCell
            }, e);
            var handled = e.isImmediatePropagationStopped();
            if (!handled) {
                if (!e.shiftKey && !e.altKey && !e.ctrlKey) {
                    if (e.which == 27) {
                        if (!getEditorLock().isActive()) {
                            return; // no editing mode to cancel, allow bubbling and default processing (exit without cancelling the event)
                        }
                        cancelEditAndSetFocus();
                    } else if (e.which == 37) {
                        handled = navigateLeft();
                    } else if (e.which == 39) {
                        handled = navigateRight();
                    } else if (e.which == 38) {
                        handled = navigateUp();
                    } else if (e.which == 40) {
                        handled = navigateDown();
                    } else if (e.which == 9) {
                        handled = navigateNext();
                    } else if (e.which == 13) {
                        if (options.editable) {
                            if (currentEditor) {
                                // adding new row
                                if (activeRow === getDataLength()) {
                                    navigateDown();
                                } else {
                                    commitEditAndSetFocus();
                                }
                            } else {
                                if (getEditorLock().commitCurrentEdit()) {
                                    makeActiveCellEditable();
                                }
                                navigateNext();
                            }
                        }
                        handled = true;
                    }
                } else if (e.which == 9 && e.shiftKey && !e.ctrlKey && !e.altKey) {
                    handled = navigatePrev();
                } else if (e.ctrlKey && e.keyCode == 67) {    //ctrl+c
                    copytoClipboard();
                } else if (e.ctrlKey && e.keyCode == 86) {      //ctrl+v
                    copyfromClipboard();
                }
            }

            if (handled) {
                // the event has been handled so don't let parent element (bubbling/propagation) or browser (default) handle it
                e.stopPropagation();
                e.preventDefault();
                try {
                    e.originalEvent.keyCode = 0; // prevent default behaviour for special keys in IE browsers (F3, F5, etc.)
                }
                // ignore exceptions - setting the original event's keycode throws
                // access denied exception for "Ctrl" (hitting control key only, nothing else), "Shift" (maybe others)
                catch (error) {
                }
            }
        }

        function copytoClipboard() {
            var cVal, rVal = "";
            var cell = getActiveCell();
            var dd = getData();
            var isRowSelector = columns[cell.cell].isRowSelector;

            if (isRowSelector && isRowSelector == true) {
                for (var i = 0; i < columns.length; i++) {
                    cVal = dd[cell.row][columns[i].field];
                    if (cVal != undefined) {
                        rVal += cVal + "\t";
                    } else {
                        rVal += " " + "\t";
                    }
                }
                rVal.trim("\t");
            }
            else {
                rVal = dd[cell.row][columns[cell.cell].field];
            }

            if (rVal != "") {
                window.clipboardData.setData("text", rVal);
            }
        }

        function copyfromClipboard() {
            var ptxt = window.clipboardData.getData("text").split('\t');
            var dd = getData();
            var cell = getActiveCell();
            var len = 0;

            if (dd.length - cell.cell < ptxt.length) {
                len = dd.length - cell.cell;
            }
            else {
                len = ptxt.length;
            }

            for (var i = 0; i < len; i++) {
                if (ptxt[i]) {
                    dd[cell.row][columns[cell.cell + i].field] = ptxt[i];
                }
            }
            dd[cell.row]["sta"] = 0;
            updateRow(cell.row);
            render();
        }

        function handleClick(e) {
            if (!currentEditor) {
                // if this click resulted in some cell child node getting focus,
                // don't steal it back - keyboard events will still bubble up
                if (e.target != document.activeElement || $(e.target).hasClass("slick-cell")) {
                    setFocus();
                }
            }

            var cell = getCellFromEvent(e);
            if (!cell || (currentEditor !== null && activeRow == cell.row && activeCell == cell.cell)) {
                return;
            }

            trigger(self.onClick, {
                row: cell.row,
                cell: cell.cell
            }, e);
            if (e.isImmediatePropagationStopped()) {
                return;
            }

            if (canCellBeActive(cell.row, cell.cell) == true) {
                if (!getEditorLock().isActive() || getEditorLock().commitCurrentEdit()) {
                    setActiveCellInternal(getCellNode(cell.row, cell.cell), (cell.row === getDataLength()) || options.autoEdit);
                }
            }
        }

        function handleContextMenu(e) {
            var $cell = $(e.target).closest(".slick-cell", $canvas);
            if ($cell.length === 0) {
                return;
            }

            // are we editing this cell?
            if (activeCellNode === $cell[0] && currentEditor !== null) {
                return;
            }

            //set the active cell to update the ui - don't update ui if multiple rows or cells are already selected
            var activeCell;
            if (getSelectedRows().length < 2) {
                var ranges = self.getSelectionModel().getSelectedRanges();
                if (ranges && ranges[0] && (ranges[0].fromCell == ranges[0].toCell)) {
                    var c = getCellFromEvent(e);
                    setActiveCell(c.row, c.cell);
                    activeCell = { row: c.row, cell: c.cell };
                }
            }

            trigger(self.onContextMenu, activeCell, e);
        }

        function handleDblClick(e) {
            var cell = getCellFromEvent(e);
            if (!cell || (currentEditor !== null && activeRow == cell.row && activeCell == cell.cell)) {
                return;
            }

            trigger(self.onDblClick, {
                row: cell.row,
                cell: cell.cell
            }, e);
            if (e.isImmediatePropagationStopped()) {
                return;
            }

            if (options.editable) {
                gotoCell(cell.row, cell.cell, true);
            }
        }

        function handleHeaderMouseEnter(e) {
            trigger(self.onHeaderMouseEnter, {
                "column": $(this).data("column")
            }, e);
        }

        function handleHeaderMouseLeave(e) {
            trigger(self.onHeaderMouseLeave, {
                "column": $(this).data("column")
            }, e);
        }

        function handleHeaderContextMenu(e) {
            var $header = $(e.target).closest(".slick-header-column", ".slick-header-columns");
            var column = $header && $header.data("column");
            trigger(self.onHeaderContextMenu, {
                column: column
            }, e);
        }

        function handleHeaderClick(e) {
            var $header = $(e.target).closest(".slick-header-column", ".slick-header-columns");
            var column = $header && $header.data("column");
            if (column) {
                trigger(self.onHeaderClick, { column: column }, e);
            }
        }

        function handleRowMouseEnter(e) {
            var row = getRowFromNode($(e.currentTarget));
            trigger(self.onRowMouseEnter, {
                row: row
            }, e);
        }

        function handleRowMouseLeave(e) {
            var row = getRowFromNode($(e.currentTarget));
            trigger(self.onRowMouseLeave, {
                row: row
            }, e);
        }

        function handleMouseEnter(e) {
            trigger(self.onMouseEnter, {}, e);
        }

        function handleMouseLeave(e) {
            if ($(e.target).is("div.slick-cell")
                && currentEditor) {
                if (e.target.type != "img"
                    && !$(e.relatedTarget).hasClass("ui-datepicker")    //embeded datepicker
                    && !$(e.relatedTarget).hasClass("esLi")             //embeded dropdownlist
                    ) {
                    getEditorLock().commitCurrentEdit();
                }
                setFocus();
            }
            trigger(self.onMouseLeave, {}, e);
        }

        function cellExists(row, cell) {
            return !(row < 0 || row >= getDataLength() || cell < 0 || cell >= columns.length);
        }

        function getCellFromPoint(x, y) {
            var row = Math.floor((y + offset) / options.rowHeight);
            var cell = 0;

            var w = 0;
            for (var i = 0; i < columns.length && w < x; i++) {
                w += columns[i].width;
                cell++;
            }

            if (cell < 0) {
                cell = 0;
            }

            return {
                row: row,
                cell: cell - 1
            };
        }

        function getCellFromNode(cellNode) {
            // read column number from .l<columnNumber> CSS class
            var cls = /l\d+/.exec(cellNode.className);
            if (!cls) {
                throw "getCellFromNode: cannot get cell - " + cellNode.className;
            }
            return parseInt(cls[0].substr(1, cls[0].length - 1), 10);
        }

        function getRowFromNode(rowNode) {
            for (var row in rowsCache) {
                if (rowsCache[row].rowNode[0] === rowNode[0]) {
                    return row | 0;
                }
            }

            return null;
        }

        function getCellFromEvent(e) {
            var $cell = $(e.target).closest(".slick-cell", $canvas);
            if (!$cell.length) {
                return null;
            }

            // TODO: This change eliminates the need for getCellFromEvent since
            //  we're ultimately calling getCellFromPoint.  Need to further analyze
            //  if getCellFromEvent can work with frozen columns

            var c = $cell.parents('.grid-canvas').offset();
            if (!c) {
                return null;
            }

            var rowOffset = 0;
            var isBottom = $cell.parents('.grid-canvas-bottom').length;

            var row = getCellFromPoint(e.clientX - c.left, e.clientY - c.top + rowOffset + $(document).scrollTop()).row;
            var cell = getCellFromNode($cell[0]);

            if (row == null || cell == null) {
                return null;
            } else {
                return {
                    "row": row,
                    "cell": cell
                };
            }
        }

        function getCellNodeBox(row, cell) {
            if (!cellExists(row, cell)) {
                return null;
            }

            var y1 = row * options.rowHeight - offset;
            var y2 = y1 + options.rowHeight - 1;
            var x1 = 0;
            for (var i = 0; i < cell; i++) {
                x1 += columns[i].width;

                if (options.frozenColumn == i) {
                    x1 = 0;
                }
            }
            var x2 = x1 + columns[cell].width;

            return {
                top: y1,
                left: x1,
                bottom: y2,
                right: x2
            };
        }

        //////////////////////////////////////////////////////////////////////////////////////////////
        // Cell switching

        function resetActiveCell() {
            setActiveCellInternal(null, false);
        }

        function setFocus() {
            if (tabbingDirection == -1) {
                $focusSink[0].focus();
            } else {
                $focusSink2[0].focus();
            }
        }

        function scrollCellIntoView(row, cell) {
            // Don't scroll to frozen cells
            if (cell <= options.frozenColumn) {
                return;
            }

            var colspan = getColspan(row, cell);
            var left = columnPosLeft[cell],
                right = columnPosRight[cell + (colspan > 1 ? colspan - 1 : 0)],
                scrollRight = scrollLeft + $viewportScrollContainerX.width();
            //scrollRight = scrollLeft;

            if (left < scrollLeft) {
                $viewportScrollContainerX.scrollLeft(left);
                handleScroll();
                render();
            } else if (right > scrollRight) {
                $viewportScrollContainerX.scrollLeft(Math.min(left, right - $viewportScrollContainerX[0].clientWidth));
                handleScroll();
                render();
            }
        }

        function setActiveCellInternal(newCell, editMode) {
            if (activeCellNode !== null) {
                makeActiveCellNormal();
                $(activeCellNode).removeClass("active");
                if (rowsCache[activeRow]) {
                    $(rowsCache[activeRow].rowNode).removeClass("active");
                }
            }

            var activeCellChanged = (activeCellNode !== newCell);
            activeCellNode = newCell;

            if (activeCellNode != null) {
                var $activeCellNode = $(activeCellNode);
                var $activeCellOffset = $activeCellNode.offset();

                var rowOffset = Math.floor($activeCellNode.parents('.grid-canvas').offset().top);
                var isBottom = $activeCellNode.parents('.grid-canvas-bottom').length;

                cell = getCellFromPoint($activeCellOffset.left, Math.ceil($activeCellOffset.top) - rowOffset);

                activeRow = cell.row;
                activeCell = activePosX = activeCell = activePosX = getCellFromNode(activeCellNode[0]);

                $(activeCellNode).addClass("active");
                $(rowsCache[activeRow].rowNode).addClass("active");

                if (options.editable && editMode && isCellPotentiallyEditable(activeRow, activeCell)) {
                    clearTimeout(h_editorLoader);

                    if (options.asyncEditorLoading) {
                        h_editorLoader = setTimeout(function () {
                            makeActiveCellEditable();
                        }, options.asyncEditorLoadDelay);
                    } else {
                        makeActiveCellEditable();
                    }
                }
            } else {
                activeRow = activeCell = null;
            }

            if (activeCellChanged) {
                setTimeout(scrollActiveCellIntoView, 50);
                trigger(self.onActiveCellChanged, getActiveCell());
            }
        }

        function clearTextSelection() {
            if (document.selection && document.selection.empty) {
                document.selection.empty();
            } else if (window.getSelection) {
                var sel = window.getSelection();
                if (sel && sel.removeAllRanges) {
                    sel.removeAllRanges();
                }
            }
        }

        function isCellPotentiallyEditable(row, cell) {
            // is the data for this row loaded?
            if (row < getDataLength() && !getDataItem(row)) {
                return false;
            }

            // are we in the Add New row?  can we create new from this cell?
            if (columns[cell].cannotTriggerInsert && row >= getDataLength()) {
                return false;
            }

            // does this cell have an editor?
            if (!getEditor(row, cell)) {
                return false;
            }

            return true;
        }

        function makeActiveCellNormal() {
            if (!currentEditor) {
                return;
            }
            trigger(self.onBeforeCellEditorDestroy, {
                editor: currentEditor
            });
            currentEditor.destroy();
            currentEditor = null;

            if (activeCellNode) {
                var d = getDataItem(activeRow);
                $(activeCellNode).removeClass("editable invalid");
                if (d) {
                    var column = columns[activeCell];
                    var formatter = getFormatter(activeRow, column);
                    activeCellNode[0].innerHTML = formatter(activeRow, activeCell, getDataItemValueForColumn(d, column), column, getDataItem(activeRow));
                    invalidatePostProcessingResults(activeRow);
                }
            }

            // if there previously was text selected on a page (such as selected
            // text in the edit cell just removed),
            // IE can't set focus to anything else correctly
            if (navigator.userAgent.toLowerCase().match(/msie/)) {
                clearTextSelection();
            }

            getEditorLock().deactivate(editController);
        }

        function makeActiveCellEditable(editor) {
            if (!activeCellNode) {
                return;
            }
            if (!options.editable) {
                throw "Grid : makeActiveCellEditable : should never get called when options.editable is false";
            }

            // cancel pending async call if there is one
            clearTimeout(h_editorLoader);

            if (!isCellPotentiallyEditable(activeRow, activeCell)) {
                return;
            }

            var columnDef = columns[activeCell];
            var item = getDataItem(activeRow);

            if (trigger(self.onBeforeEditCell, {
                row: activeRow,
                cell: activeCell,
                item: item,
                column: columnDef
            }) === false) {
                setFocus();
                return;
            }

            getEditorLock().activate(editController);
            $(activeCellNode).addClass("editable");

            // don't clear the cell if a custom editor is passed through
            if (!columnDef.editorRefered && !editor) {
                activeCellNode[0].innerHTML = "";
            }

            currentEditor = new (editor || getEditor(activeRow, activeCell))({
                grid: self,
                gridPosition: absBox($container[0]),
                position: absBox(activeCellNode[0]),
                container: activeCellNode,
                column: columnDef,
                item: item || {},
                commitChanges: commitEditAndSetFocus,
                cancelChanges: cancelEditAndSetFocus
            });

            if (item) {
                currentEditor.loadValue(item);
            }

            serializedEditorValue = currentEditor.serializeValue();

            if (currentEditor.position) {
                handleActiveCellPositionChange();
            }
        }

        function commitEditAndSetFocus() {
            // if the commit fails, it would do so due to a validation error
            // if so, do not steal the focus from the editor
            if (getEditorLock().commitCurrentEdit()) {
                setFocus();
                if (options.autoEdit) {
                    navigateNext();
                }
            }
        }

        function cancelEditAndSetFocus() {
            if (getEditorLock().cancelCurrentEdit()) {
                setFocus();
            }
        }

        function absBox(elem) {
            var box = {
                top: elem.offsetTop,
                left: elem.offsetLeft,
                bottom: 0,
                right: 0,
                width: $(elem).outerWidth(),
                height: $(elem).outerHeight(),
                visible: true
            };
            box.bottom = box.top + box.height;
            box.right = box.left + box.width;

            // walk up the tree
            var offsetParent = elem.offsetParent;
            while ((elem = elem.parentNode) != document.body) {
                if (box.visible && elem.scrollHeight != elem.offsetHeight && $(elem).css("overflowY") != "visible") {
                    box.visible = box.bottom > elem.scrollTop && box.top < elem.scrollTop + elem.clientHeight;
                }

                if (box.visible && elem.scrollWidth != elem.offsetWidth && $(elem).css("overflowX") != "visible") {
                    box.visible = box.right > elem.scrollLeft && box.left < elem.scrollLeft + elem.clientWidth;
                }

                box.left -= elem.scrollLeft;
                box.top -= elem.scrollTop;

                if (elem === offsetParent) {
                    box.left += elem.offsetLeft;
                    box.top += elem.offsetTop;
                    offsetParent = elem.offsetParent;
                }

                box.bottom = box.top + box.height;
                box.right = box.left + box.width;
            }

            return box;
        }

        function getActiveCellPosition() {
            return absBox(activeCellNode[0]);
        }

        function getGridPosition() {
            return absBox($container[0]);
        }

        function handleActiveCellPositionChange() {
            if (!activeCellNode) {
                return;
            }

            trigger(self.onActiveCellPositionChanged, {});

            if (currentEditor) {
                var cellBox = getActiveCellPosition();
                if (currentEditor.show && currentEditor.hide) {
                    if (!cellBox.visible) {
                        currentEditor.hide();
                    } else {
                        currentEditor.show();
                    }
                }

                if (currentEditor.position) {
                    currentEditor.position(cellBox);
                }
            }
        }

        function getCellEditor() {
            return currentEditor;
        }

        function getActiveCell() {
            if (!activeCellNode) {
                return null;
            } else {
                return {
                    row: activeRow,
                    cell: activeCell
                };
            }
        }

        function getActiveCellNode() {
            return activeCellNode;
        }

        function scrollActiveCellIntoView() {
            if (activeRow != null && activeCell != null) {
                scrollCellIntoView(activeRow, activeCell);
            }
        }

        function scrollRowIntoView(row, doPaging) {

            var viewportScrollH = $viewportScrollContainerY.height();

            var rowAtTop = row * options.rowHeight;
            var rowAtBottom = (row + 1) * options.rowHeight
                            - viewportScrollH
                            + (viewportHasHScroll ? scrollbarDimensions.height : 0);

            // need to page down?
            if ((row + 1) * options.rowHeight > scrollTop + viewportScrollH + offset) {
                scrollTo(doPaging ? rowAtTop : rowAtBottom);
                render();
            }
                // or page up?
            else if (row * options.rowHeight < scrollTop + offset) {
                scrollTo(doPaging ? rowAtBottom : rowAtTop);
                render();
            }
        }

        function scrollRowToTop(row) {
            scrollTo(row * options.rowHeight);
            render();
        }

        function scrollRowToCurrentTop() {
            scrollTo(scrollTop);
            render();
        }

        function getColspan(row, cell) {
            var metadata = data.getItemMetadata && data.getItemMetadata(row);
            if (!metadata || !metadata.columns) {
                return 1;
            }

            var columnData = metadata.columns[columns[cell].id] || metadata.columns[cell];
            var colspan = (columnData && columnData.colspan);
            if (colspan === "*") {
                colspan = columns.length - cell;
            } else {
                colspan = colspan || 1;
            }
            return (colspan || 1);
        }

        function findFirstFocusableCell(row) {
            var cell = 0;
            while (cell < columns.length) {
                if (canCellBeActive(row, cell)) {
                    return cell;
                }
                cell += getColspan(row, cell);
            }
            return null;
        }

        function findLastFocusableCell(row) {
            var cell = 0;
            var lastFocusableCell = null;
            while (cell < columns.length) {
                if (canCellBeActive(row, cell)) {
                    lastFocusableCell = cell;
                }
                cell += getColspan(row, cell);
            }
            return lastFocusableCell;
        }

        function gotoRight(row, cell, posX) {
            if (cell >= columns.length) {
                return null;
            }

            do {
                cell += getColspan(row, cell);
            } while (cell < columns.length && !canCellBeActive(row, cell));

            if (cell < columns.length) {
                return {
                    "row": row,
                    "cell": cell,
                    "posX": cell
                };
            }
            return null;
        }

        function gotoLeft(row, cell, posX) {
            if (cell <= 0) {
                return null;
            }

            var firstFocusableCell = findFirstFocusableCell(row);
            if (firstFocusableCell === null || firstFocusableCell >= cell) {
                return null;
            }

            var prev = {
                "row": row,
                "cell": firstFocusableCell,
                "posX": firstFocusableCell
            };
            var pos;
            while (true) {
                pos = gotoRight(prev.row, prev.cell, prev.posX);
                if (!pos) {
                    return null;
                }
                if (pos.cell >= cell) {
                    return prev;
                }
                prev = pos;
            }
        }

        function gotoDown(row, cell, posX) {
            var prevCell;
            while (true) {
                if (++row >= getDataLength() + (options.enableAddRow ? 1 : 0)) {
                    return null;
                }

                prevCell = cell = 0;
                while (cell <= posX) {
                    prevCell = cell;
                    cell += getColspan(row, cell);
                }

                if (canCellBeActive(row, prevCell)) {
                    return {
                        "row": row,
                        "cell": prevCell,
                        "posX": posX
                    };
                }
            }
        }

        function gotoUp(row, cell, posX) {
            var prevCell;
            while (true) {
                if (--row < 0) {
                    return null;
                }

                prevCell = cell = 0;
                while (cell <= posX) {
                    prevCell = cell;
                    cell += getColspan(row, cell);
                }

                if (canCellBeActive(row, prevCell)) {
                    return {
                        "row": row,
                        "cell": prevCell,
                        "posX": posX
                    };
                }
            }
        }

        function gotoNext(row, cell, posX) {
            if (row == null && cell == null) {
                row = cell = posX = 0;
                if (canCellBeActive(row, cell)) {
                    return {
                        "row": row,
                        "cell": cell,
                        "posX": cell
                    };
                }
            }

            var pos = gotoRight(row, cell, posX);
            if (pos) {
                return pos;
            }

            var firstFocusableCell = null;
            while (++row < getDataLength() + (options.enableAddRow ? 1 : 0)) {
                firstFocusableCell = findFirstFocusableCell(row);
                if (firstFocusableCell !== null) {
                    return {
                        "row": row,
                        "cell": firstFocusableCell,
                        "posX": firstFocusableCell
                    };
                }
            }
            return null;
        }

        function gotoPrev(row, cell, posX) {
            if (row == null && cell == null) {
                row = getDataLength() + (options.enableAddRow ? 1 : 0) - 1;
                cell = posX = columns.length - 1;
                if (canCellBeActive(row, cell)) {
                    return {
                        "row": row,
                        "cell": cell,
                        "posX": cell
                    };
                }
            }

            var pos;
            var lastSelectableCell;
            while (!pos) {
                pos = gotoLeft(row, cell, posX);
                if (pos) {
                    break;
                }
                if (--row < 0) {
                    return null;
                }

                cell = 0;
                lastSelectableCell = findLastFocusableCell(row);
                if (lastSelectableCell !== null) {
                    pos = {
                        "row": row,
                        "cell": lastSelectableCell,
                        "posX": lastSelectableCell
                    };
                }
            }
            return pos;
        }

        function navigateRight() {
            return navigate("right");
        }

        function navigateLeft() {
            return navigate("left");
        }

        function navigateDown() {
            return navigate("down");
        }

        function navigateUp() {
            return navigate("up");
        }

        function navigateNext() {
            return navigate("next");
        }

        function navigatePrev() {
            return navigate("prev");
        }

        /**
         * @param {string} dir Navigation direction.
         * @return {boolean} Whether navigation resulted in a change of active cell.
         */
        function navigate(dir) {
            if (!options.enableCellNavigation) {
                return false;
            }

            if (!activeCellNode && dir != "prev" && dir != "next") {
                return false;
            }

            if (!getEditorLock().commitCurrentEdit()) {
                return true;
            }
            setFocus();

            var tabbingDirections = {
                "up": -1,
                "down": 1,
                "left": -1,
                "right": 1,
                "prev": -1,
                "next": 1
            };
            tabbingDirection = tabbingDirections[dir];

            var stepFunctions = {
                "up": gotoUp,
                "down": gotoDown,
                "left": gotoLeft,
                "right": gotoRight,
                "prev": gotoPrev,
                "next": gotoNext
            };
            var stepFn = stepFunctions[dir];
            var pos = stepFn(activeRow, activeCell, activePosX);
            if (pos) {
                var isAddNewRow = (pos.row == getDataLength());
                scrollRowIntoView(pos.row, !isAddNewRow);
                scrollCellIntoView(pos.row, pos.cell);
                setActiveCellInternal(getCellNode(pos.row, pos.cell), isAddNewRow || options.autoEdit);
                activePosX = pos.posX;
                return true;
            } else {
                setActiveCellInternal(getCellNode(activeRow, activeCell), (activeRow == getDataLength()) || options.autoEdit);
                return false;
            }
        }

        function getCellNode(row, cell) {
            if (rowsCache[row]) {
                ensureCellNodesInRowsCache(row);
                return rowsCache[row].cellNodesByColumnIdx[cell];
            }
            return null;
        }

        function setActiveCell(row, cell) {
            if (!initialized) {
                return;
            }
            if (row > getDataLength() || row < 0 || cell >= columns.length || cell < 0) {
                return;
            }

            if (!options.enableCellNavigation) {
                return;
            }

            scrollRowIntoView(row, false);
            scrollCellIntoView(row, cell);
            setActiveCellInternal(getCellNode(row, cell), false);
        }

        function canCellBeActive(row, cell) {
            if (!options.enableCellNavigation || row >= getDataLength() + (options.enableAddRow ? 1 : 0) || row < 0 || cell >= columns.length || cell < 0) {
                return false;
            }

            var rowMetadata = data.getItemMetadata && data.getItemMetadata(row);
            if (rowMetadata && typeof rowMetadata.focusable === "boolean") {
                return rowMetadata.focusable;
            }

            var columnMetadata = rowMetadata && rowMetadata.columns;
            if (columnMetadata && columnMetadata[columns[cell].id] && typeof columnMetadata[columns[cell].id].focusable === "boolean") {
                return columnMetadata[columns[cell].id].focusable;
            }
            if (columnMetadata && columnMetadata[cell] && typeof columnMetadata[cell].focusable === "boolean") {
                return columnMetadata[cell].focusable;
            }

            if (typeof columns[cell].focusable === "boolean") {
                return columns[cell].focusable;
            }

            return true;
        }

        function canCellBeSelected(row, cell) {
            if (row >= getDataLength() || row < 0 || cell >= columns.length || cell < 0) {
                return false;
            }

            var rowMetadata = data.getItemMetadata && data.getItemMetadata(row);
            if (rowMetadata && typeof rowMetadata.selectable === "boolean") {
                return rowMetadata.selectable;
            }

            var columnMetadata = rowMetadata && rowMetadata.columns && (rowMetadata.columns[columns[cell].id] || rowMetadata.columns[cell]);
            if (columnMetadata && typeof columnMetadata.selectable === "boolean") {
                return columnMetadata.selectable;
            }

            if (typeof columns[cell].selectable === "boolean") {
                return columns[cell].selectable;
            }

            return true;
        }

        function gotoCell(row, cell, forceEdit) {
            if (!initialized) {
                return;
            }
            if (!canCellBeActive(row, cell)) {
                return;
            }

            if (!getEditorLock().commitCurrentEdit()) {
                return;
            }

            scrollRowIntoView(row, false);
            scrollCellIntoView(row, cell);

            var newCell = getCellNode(row, cell);

            // if selecting the 'add new' row, start editing right away
            setActiveCellInternal(newCell, forceEdit || (row === getDataLength()) || options.autoEdit);

            // if no editor was created, set the focus back on the grid
            if (!currentEditor) {
                setFocus();
            }
        }


        //////////////////////////////////////////////////////////////////////////////////////////////
        // IEditor implementation for the editor lock

        function commitCurrentEdit() {
            var item = getDataItem(activeRow);
            var column = columns[activeCell];

            if (currentEditor) {
                if (currentEditor.isValueChanged()) {
                    var validationResults = currentEditor.validate();

                    if (validationResults.valid) {
                        if (activeRow < getDataLength()) {
                            var editCommand = {
                                row: activeRow,
                                cell: activeCell,
                                editor: currentEditor,
                                serializedValue: currentEditor.serializeValue(),
                                prevSerializedValue: serializedEditorValue,
                                execute: function () {
                                    this.editor.applyValue(item, this.serializedValue);
                                    updateRow(this.row);
                                },
                                undo: function () {
                                    this.editor.applyValue(item, this.prevSerializedValue);
                                    updateRow(this.row);
                                }
                            };

                            if (options.editCommandHandler) {
                                makeActiveCellNormal();
                                options.editCommandHandler(item, column, editCommand);
                            } else {
                                editCommand.execute();
                                makeActiveCellNormal();
                            }

                            trigger(self.onCellChange, {
                                row: activeRow,
                                cell: activeCell,
                                item: item
                            });
                        } else {
                            var newItem = {};
                            currentEditor.applyValue(newItem, currentEditor.serializeValue());
                            makeActiveCellNormal();
                            trigger(self.onAddNewRow, {
                                item: newItem,
                                column: column
                            });
                        }

                        // check whether the lock has been re-acquired by event handlers
                        return !getEditorLock().isActive();
                    } else {
                        // TODO: remove and put in onValidationError handlers in examples
                        $(activeCellNode).removeClass("invalid");
                        $(activeCellNode).width();  // force layout
                        $(activeCellNode).addClass("invalid");

                        trigger(self.onValidationError, {
                            editor: currentEditor,
                            cellNode: activeCellNode,
                            validationResults: validationResults,
                            row: activeRow,
                            cell: activeCell,
                            column: column
                        });

                        currentEditor.focus();
                        return false;
                    }
                }

                makeActiveCellNormal();
            }
            return true;
        }

        function cancelCurrentEdit() {
            makeActiveCellNormal();
            return true;
        }

        function rowsToRanges(rows) {
            var ranges = [];
            var lastCell = columns.length - 1;
            for (var i = 0; i < rows.length; i++) {
                ranges.push(new Slick.Range(rows[i], 0, rows[i], lastCell));
            }
            return ranges;
        }

        function getSelectedRows() {
            if (!selectionModel) {
                throw "Selection model is not set";
            }
            return selectedRows;
        }

        function setSelectedRows(rows) {
            if (!selectionModel) {
                throw "Selection model is not set";
            }
            selectionModel.setSelectedRanges(rowsToRanges(rows));
        }

        function getSelectedDataItem() {
            if (!selectionModel) {
                throw "Selection model is not set";
            }

            if (data.getItemByIdx) {
                return data.getItemByIdx(selectedRows[0]);
            }
            else {
                return getDataItem(selectedRows[0]);
            }
        }

        function getSelectedDataItems() {
            if (!selectionModel) {
                throw "Selection model is not set";
            }

            var items;
            if (data.getItemByIdx) {
                //when dataview is parametered...
                items = selectedRows.map(function (x) {
                    return data.getItemByIdx(x);
                });
            }
            else {
                items = jQuery.map(selectedRows, function (x) {
                    return getDataItem(x);
                });
            }
            return items;
        }

        function getCheckedDataItem() {
            if (!selectionModel) {
                throw "Selection model is not set";
            }

            var item;
            if (data.getItems) {
                //when dataview is parametered...
                var rows = data.getItems();
                for (var i = 0; i < rows.length; i++) {
                    if (rows[i].checked == true) {
                        item = rows[i];
                        break;
                    }
                }
            }
            else {
                for (var i = 0; i < data.length; i++) {
                    if (data[i].checked == true) {
                        item = data[i];
                        break;
                    }
                }
            }
            return item;
        }

        function getCheckedDataItems() {
            if (!selectionModel) {
                throw "Selection model is not set";
            }

            var items;
            if (data.getItems) {
                //when dataview is parametered...
                var rows = data.getItems();
                items = jQuery.grep(rows, function (x) {
                    return x.checked == true;
                });
            }
            else {
                items = jQuery.grep(data, function (x) {
                    return x.checked == true;
                });
            }
            return items;
        }


        //////////////////////////////////////////////////////////////////////////////////////////////
        // Debug

        this.debug = function () {
            var s = "";

            s += ("\n" + "counter_rows_rendered:  " + counter_rows_rendered);
            s += ("\n" + "counter_rows_removed:  " + counter_rows_removed);
            s += ("\n" + "renderedRows:  " + renderedRows);
            s += ("\n" + "numVisibleRows:  " + numVisibleRows);
            s += ("\n" + "maxSupportedCssHeight:  " + maxSupportedCssHeight);
            s += ("\n" + "n(umber of pages):  " + n);
            s += ("\n" + "(current) page:  " + page);
            s += ("\n" + "page height (ph):  " + ph);
            s += ("\n" + "vScrollDir:  " + vScrollDir);

            alert(s);
        };

        // a debug helper to be able to access private members
        this.eval = function (expr) {
            return eval(expr);
        };

        //////////////////////////////////////////////////////////////////////////////////////////////
        // Public API

        $.extend(this, {
            "slickGridVersion": "2.1",

            // Events
            "onScroll": new Slick.Event(),
            "onSort": new Slick.Event(),
            "onHeaderMouseEnter": new Slick.Event(),
            "onHeaderMouseLeave": new Slick.Event(),
            "onHeaderContextMenu": new Slick.Event(),
            "onHeaderClick": new Slick.Event(),
            "onHeaderCellRendered": new Slick.Event(),
            "onBeforeHeaderCellDestroy": new Slick.Event(),
            "onHeaderRowCellRendered": new Slick.Event(),
            "onBeforeHeaderRowCellDestroy": new Slick.Event(),
            "onRowMouseEnter": new Slick.Event(),
            "onRowMouseLeave": new Slick.Event(),
            "onMouseEnter": new Slick.Event(),
            "onMouseLeave": new Slick.Event(),
            "onClick": new Slick.Event(),
            "onDblClick": new Slick.Event(),
            "onContextMenu": new Slick.Event(),
            "onKeyDown": new Slick.Event(),
            "onAddNewRow": new Slick.Event(),
            "onValidationError": new Slick.Event(),
            "onViewportChanged": new Slick.Event(),
            "onColumnsReordered": new Slick.Event(),
            "onColumnsResized": new Slick.Event(),
            "onCellChange": new Slick.Event(),
            "onBeforeEditCell": new Slick.Event(),
            "onBeforeCellEditorDestroy": new Slick.Event(),
            "onBeforeDestroy": new Slick.Event(),
            "onActiveCellChanged": new Slick.Event(),
            "onActiveCellPositionChanged": new Slick.Event(),
            "onDragInit": new Slick.Event(),
            "onDragStart": new Slick.Event(),
            "onDrag": new Slick.Event(),
            "onDragEnd": new Slick.Event(),
            "onSelectedRowsChanged": new Slick.Event(),
            "onCellCssStylesChanged": new Slick.Event(),

            // Methods
            "registerPlugin": registerPlugin,
            "unregisterPlugin": unregisterPlugin,
            "getColumns": getColumns,
            "setColumns": setColumns,
            "getColumnIndex": getColumnIndex,
            "updateColumnHeader": updateColumnHeader,
            "setSortColumn": setSortColumn,
            "setSortColumns": setSortColumns,
            "getSortColumns": getSortColumns,
            "autosizeColumns": autosizeColumns,
            "getOptions": getOptions,
            "setOptions": setOptions,
            "getData": getData,
            "getDataLength": getDataLength,
            "getDataItem": getDataItem,
            "setData": setData,
            "getSelectionModel": getSelectionModel,
            "setSelectionModel": setSelectionModel,
            "getSelectedRows": getSelectedRows,
            "setSelectedRows": setSelectedRows,
            "getSelectedDataItem": getSelectedDataItem,
            "getSelectedDataItems": getSelectedDataItems,
            "getCheckedDataItem": getCheckedDataItem,
            "getCheckedDataItems": getCheckedDataItems,
            "getVisibleColumns": getVisibleColumns,
            "getGridId": getGridId,

            "getHeadersWidth": getHeadersWidth,
            "getHeaderColumnWidthDiff": getHeaderColumnWidthDiff,

            "render": render,
            "invalidate": invalidate,
            "invalidateRow": invalidateRow,
            "invalidateRows": invalidateRows,
            "invalidateAllRows": invalidateAllRows,
            "updateCell": updateCell,
            "updateRow": updateRow,
            "getViewport": getVisibleRange,
            "getRenderedRange": getRenderedRange,
            "resizeCanvas": resizeCanvas,
            "updateRowCount": updateRowCount,
            "scrollRowIntoView": scrollRowIntoView,
            "scrollRowToTop": scrollRowToTop,
            "scrollCellIntoView": scrollCellIntoView,
            "scrollActiveCellIntoView": scrollActiveCellIntoView,
            "getCanvasNode": getCanvasNode,
            "getCanvases": getCanvases,
            "getActiveCanvasNode": getActiveCanvasNode,
            "setActiveCanvasNode": setActiveCanvasNode,
            "getViewportNode": getViewportNode,
            "getActiveViewportNode": getActiveViewportNode,
            "setActiveViewportNode": setActiveViewportNode,
            "focus": setFocus,

            "getCellFromPoint": getCellFromPoint,
            "getCellFromEvent": getCellFromEvent,
            "getActiveCell": getActiveCell,
            "setActiveCell": setActiveCell,
            "getActiveCellNode": getActiveCellNode,
            "getActiveCellPosition": getActiveCellPosition,
            "resetActiveCell": resetActiveCell,
            "editActiveCell": makeActiveCellEditable,
            "getCellEditor": getCellEditor,
            "getCellNode": getCellNode,
            "getCellNodeBox": getCellNodeBox,
            "canCellBeSelected": canCellBeSelected,
            "canCellBeActive": canCellBeActive,
            "navigatePrev": navigatePrev,
            "navigateNext": navigateNext,
            "navigateUp": navigateUp,
            "navigateDown": navigateDown,
            "navigateLeft": navigateLeft,
            "navigateRight": navigateRight,
            "gotoCell": gotoCell,
            "getGridPosition": getGridPosition,
            "flashCell": flashCell,
            "addCellCssStyles": addCellCssStyles,
            "setCellCssStyles": setCellCssStyles,
            "removeCellCssStyles": removeCellCssStyles,
            "getCellCssStyles": getCellCssStyles,

            "init": finishInitialization,
            "destroy": destroy,

            // IEditor implementation
            "getEditorLock": getEditorLock,
            "getEditController": getEditController
        });

        init();
    }
}(jQuery));
//#endregion