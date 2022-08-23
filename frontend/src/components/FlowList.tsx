import {
  useSearchParams,
  Link,
  useParams,
  useNavigate,
} from "react-router-dom";
import { useCallback, useEffect, useState, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Flow, FullFlow, useTulip } from "../api";
import {
  SERVICE_FILTER_KEY,
  TEXT_FILTER_KEY,
  START_FILTER_KEY,
  END_FILTER_KEY,
} from "../App";

import { HeartIcon, FilterIcon, LinkIcon } from "@heroicons/react/solid";
import {
  HeartIcon as EmptyHeartIcon,
  FilterIcon as EmptyFilterIcon,
} from "@heroicons/react/outline";

import classes from "./FlowList.module.css";
import { format } from "date-fns";
import useDebounce from "../hooks/useDebounce";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import classNames from "classnames";
import { Tag } from "./Tag";
import { lastRefreshAtom } from "./Header";

export function FlowList() {
  let [searchParams] = useSearchParams();
  let params = useParams();

  const { services, api, getFlows } = useTulip();

  const [flowList, setFlowList] = useState<Flow[]>([]);

  // Set default flowIndex to Infinity, so that initialTopMostItemIndex != 0 and therefore scrolledToInitialItem != true
  const [flowIndex, setFlowIndex] = useState<number>(1);

  const virtuoso = useRef<VirtuosoHandle>(null);

  const service_name = searchParams.get(SERVICE_FILTER_KEY) ?? "";
  const service = services.find((s) => s.name == service_name);

  const text_filter = searchParams.get(TEXT_FILTER_KEY) ?? undefined;
  const from_filter = searchParams.get(START_FILTER_KEY) ?? undefined;
  const to_filter = searchParams.get(END_FILTER_KEY) ?? undefined;

  const debounced_text_filter = useDebounce(text_filter, 300);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  const [lastRefresh, setLastRefresh] = useAtom(lastRefreshAtom);

  useEffect(() => {
    const fetchData = async () => {
      const data = await api.getTags();
      setAvailableTags(data);
      console.log(data);
    };
    fetchData().catch(console.error);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const data = await getFlows({
        "flow.data": debounced_text_filter,
        dst_ip: service?.ip,
        dst_port: service?.port,
        from_time: from_filter,
        to_time: to_filter,
        service: "", // FIXME
        tags: selectedTags,
      });
      data.forEach((flow, index) => {
        if (flow._id.$oid === params.id) { setFlowIndex(index) }
      })

      setFlowList(data);
      setLoading(false);

    };
    fetchData().catch(console.error);
  }, [
    service,
    debounced_text_filter,
    from_filter,
    to_filter,
    selectedTags,
    lastRefresh,
    params,
    virtuoso
  ]);

  const onHeartHandler = useCallback(async (flow: Flow) => {
    await api.starFlow(flow._id.$oid, !flow.tags.includes("starred"));
    // optimistic update
    const newFlow = { ...flow };
    setFlowList((prev) =>
      prev.map((f) => (f._id.$oid === flow._id.$oid ? newFlow : f))
    );
  }, []);

  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white border-b-gray-300 border-b shadow-md flex flex-col">
        <div className="p-2 flex" style={{ height: 50 }}>
          <button
            className="flex gap-1 items-center text-sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            {<FilterIcon height={20} className="text-gray-400"></FilterIcon>}
            {showFilters ? "Close" : "Open"} filters
          </button>
          {/* Maybe we want to use a search button instead of live search */}
          {false && (
            <button className="ml-auto items-center bg-blue-600 text-white px-2 rounded-md text-sm">
              Search
            </button>
          )}
        </div>
        {showFilters && (
          <div className="border-t-gray-300 border-t p-2">
            <p className="text-sm font-bold text-gray-600 pb-2">
              Intersection filter
            </p>
            <div className="flex gap-2 flex-wrap">
              {availableTags.map((tag) => (
                <Tag
                  key={tag}
                  tag={tag}
                  disabled={!selectedTags.includes(tag)}
                  onClick={() =>
                    setSelectedTags(
                      selectedTags.includes(tag)
                        ? selectedTags.filter((t) => t != tag)
                        : [...selectedTags, tag]
                    )
                  }
                ></Tag>
              ))}
            </div>
          </div>
        )}
      </div>
      <div></div>
      <Virtuoso
        className={classNames({
          "flex-1": true,
          [classes.list_container]: true,
          "sidebar-loading": loading,
        })}
        data={flowList}
        ref={virtuoso}
        initialTopMostItemIndex={flowIndex}
        itemContent={(index, flow) => (
          <Link
            to={`/flow/${flow._id.$oid}?${searchParams}`}
            key={flow._id.$oid}
            className="focus-visible:rounded-md"
          >
            <FlowListEntry
              key={flow._id.$oid}
              flow={flow}
              isActive={flow._id.$oid === params.id}
              onHeartClick={onHeartHandler}
            />
          </Link>
        )}
      />
    </div>
  );
}

interface FlowListEntryProps {
  flow: Flow;
  isActive: boolean;
  onHeartClick: (flow: Flow) => void;
}

function FlowListEntry({ flow, isActive, onHeartClick }: FlowListEntryProps) {
  const formatted_time_h_m_s = format(new Date(flow.time), "HH:mm:ss");
  const formatted_time_ms = format(new Date(flow.time), ".SSS");

  const isStarred = flow.tags.includes("starred");
  // Filter tag list for tags that are handled specially
  const filtered_tag_list = flow.tags.filter((t) => t != "starred");

  const duration =
    flow.duration > 10000 ? (
      <div className="text-red-500">&gt;10s</div>
    ) : (
      <div>{flow.duration}ms</div>
    );
  return (
    <li
      className={classNames({
        [classes.active]: isActive,
      })}
    >
      <div className="flex">
        <div
          className="w-5 ml-1 mr-1 self-center shrink-0"
          onClick={() => {
            onHeartClick(flow);
          }}
        >
          {flow.tags.includes("starred") ? (
            <HeartIcon className="text-red-500" />
          ) : (
            <EmptyHeartIcon />
          )}
        </div>

        <div className="w-5 mr-2 self-center shrink-0">
          {flow.child_id.$oid != "000000000000000000000000" || flow.parent_id.$oid != "000000000000000000000000" ? (
            <LinkIcon className="text-blue-500" />
          ) : undefined}
        </div>
        <div className="flex-1 shrink">
          <div className="flex">
            <div className="shrink-0">
              <span className="text-gray-700 font-bold overflow-ellipsis overflow-hidden ">
                {flow.service_tag}
              </span>
              <span className="text-gray-500">:{flow.dst_port}</span>
            </div>

            <div className="ml-2">
              <span className="text-gray-500">{formatted_time_h_m_s}</span>
              <span className="text-gray-300">{formatted_time_ms}</span>
            </div>
            <div className="text-gray-500 ml-auto">{duration}</div>
          </div>
          <div className="flex h-5 gap-2">
            {filtered_tag_list.map((tag) => (
              <Tag key={tag} tag={tag}></Tag>
            ))}
          </div>
        </div>
      </div>
    </li>
  );
}
